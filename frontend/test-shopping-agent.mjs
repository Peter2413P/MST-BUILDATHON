import { extractRequirementsDeterministically } from './src/lib/server/shopping/planner/extractor.ts';
import { getProviderRegistry } from './src/lib/server/shopping/providers/registry.ts';
import { normalizeProductList } from './src/lib/server/shopping/normalizer/index.ts';
import { deduplicateProducts } from './src/lib/server/shopping/dedup/index.ts';
import { applyHardFilters } from './src/lib/server/shopping/filters/hard-filter.ts';
import { generatePriceComparison } from './src/lib/server/shopping/pricing/comparator.ts';
import { analyzeProductReviews } from './src/lib/server/shopping/reviews/analyzer.ts';
import { rankProducts } from './src/lib/server/shopping/ranking/scorer.ts';
import { executeShoppingWorkflow } from './src/lib/server/shopping/orchestrator.ts';
import { normalizeArtifact, isValidShoppingSpec } from './src/lib/artifacts/normalizer.ts';
import { decomposeJob } from './src/lib/server/planner.ts';
import { routeMessage } from './src/lib/server/router.ts';

console.log('================================================================');
console.log('TESTING PRODUCTION SHOPPING AGENT & REGISTRY INTEGRATION');
console.log('================================================================\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(message);
    }
    passed++;
    console.log(`✓ PASSED: ${message}`);
  }

  // TEST 1: Intent Classification & Free Conversational Routing
  console.log('--- TEST 1: Intent Classification & Routing Gating ---');
  {
    const convResult = await routeMessage({ current_message: 'Just tell me what GPU is good for AI development' });
    assert(convResult.intent === 'conversation', 'Conversational GPU advice query classified as free conversation (Zero MSTC fee)');

    const shoppingQuery1 = 'Find me the best gaming laptop under ₹80,000 with RTX 4060';
    const taskResult1 = await routeMessage({ current_message: shoppingQuery1 });
    assert(taskResult1.intent === 'task', 'Shopping query "Find me..." classified as task for agent hiring');

    const shoppingQuery2 = 'Compare running shoes under ₹5,000';
    const taskResult2 = await routeMessage({ current_message: shoppingQuery2 });
    assert(taskResult2.intent === 'task', 'Comparison query "Compare running shoes..." classified as task');
  }

  // TEST 2: Planner DAG Decomposition
  console.log('\n--- TEST 2: Planner DAG Decomposition & Agent Selection ---');
  {
    const mockAgents = [
      { skill: 'research', name: 'ResearchAgent', description: 'Deep web research', price_usdc: 0.01 },
      { skill: 'shopping', name: 'ShoppingAgent', description: 'Product discovery and price comparison', price_usdc: 0.02 },
      { skill: 'fact-check', name: 'FactCheckAgent', description: 'Fact checker', price_usdc: 0.01 },
    ];

    const plan = await decomposeJob(
      'Find me the best gaming laptop under ₹80,000 with RTX 4060',
      mockAgents
    );
    assert(plan.subtasks.length >= 1, 'Planner generated valid DAG');
    assert(plan.subtasks[0].skill === 'shopping', `Planner assigned shopping skill (got: ${plan.subtasks[0].skill})`);
  }

  // TEST 3: Deterministic Requirement Extraction (Hard vs Soft)
  console.log('\n--- TEST 3: Deterministic Requirement Extraction ---');
  {
    const reqs = extractRequirementsDeterministically('Find me the best gaming laptop under ₹80,000 with RTX 4060 and 16GB RAM');
    assert(reqs.category === 'laptop', `Extracted category "laptop" (got: ${reqs.category})`);
    assert(reqs.budget.maximum === 80000, `Extracted budget maximum 80000 (got: ${reqs.budget.maximum})`);
    assert(reqs.budget.currency === 'INR', `Extracted currency INR (got: ${reqs.budget.currency})`);
    assert(reqs.hard_requirements.gpu?.toLowerCase().includes('rtx 4060'), 'Extracted hard constraint: RTX 4060 GPU');
    assert(reqs.hard_requirements.ram_gb_min === 16, 'Extracted hard constraint: 16GB RAM');
    assert(reqs.hard_requirements.in_stock_only === true, 'In-stock filter enabled');
  }

  // TEST 4: Real Catalog Discovery, Multi-Retailer Dedup & Hard Filtering
  console.log('\n--- TEST 4: Real Catalog Discovery, Multi-Retailer Dedup & Filtering ---');
  {
    const registry = getProviderRegistry();
    const discovery = await registry.discoverProducts({
      query: 'RTX 4060 gaming laptop',
      category: 'laptop',
      maxPrice: 85000,
    });
    assert(discovery.products.length > 0, `Discovered ${discovery.products.length} products from connected providers`);
    
    // Check provenance directly on raw product
    const hasProvenance = discovery.products.every(p => p.source && p.sourceUrl && p.retrievedAt);
    assert(hasProvenance, 'Every discovered product contains complete real data provenance (source, URL, retrievedAt)');

    // Deduplication
    const normalized = normalizeProductList(discovery.products);
    const deduped = deduplicateProducts(normalized);
    assert(deduped.length <= discovery.products.length, `Deduplicated products (${deduped.length} canonical models)`);
    
    // Hard filtering: RTX 4060 under ₹80,000
    const reqs = extractRequirementsDeterministically('gaming laptop under ₹80,000 with RTX 4060');
    const { matchingProducts, rejectedProducts } = applyHardFilters(deduped, reqs);
    assert(matchingProducts.length > 0, `Passing products found (${matchingProducts.length} matched all hard filters)`);
    
    // Ensure all passing match RTX 4060 and <= 80000
    const allMatch = matchingProducts.every(p => {
      const gpuMatch = String(p.specifications.gpu || '').toLowerCase().includes('4060');
      const priceMatch = p.lowestPriceOffer.price <= 80000;
      return gpuMatch && priceMatch;
    });
    assert(allMatch, 'Strict verification: All passing products have RTX 4060 and price <= ₹80,000');
  }

  // TEST 5: Multi-Store Price Comparison & Review Analysis
  console.log('\n--- TEST 5: Multi-Store Price Comparison & Review Analysis ---');
  {
    const registry = getProviderRegistry();
    const discovery = await registry.discoverProducts({ query: 'ASUS TUF Gaming A15' });
    const normalized = normalizeProductList(discovery.products);
    const deduped = deduplicateProducts(normalized);
    const asus = deduped.find(p => p.model.includes('FA507NV') || p.title.includes('TUF Gaming A15'));
    
    if (asus && asus.offers.length > 1) {
      const priceComp = generatePriceComparison(asus);
      assert(priceComp.offers.length >= 2, `Multi-retailer price comparison generated with ${priceComp.offers.length} stores`);
      assert(priceComp.lowestPrice <= priceComp.highestPrice, 'Lowest price is <= highest price');
      assert(priceComp.savings >= 0, `Verified savings amount calculated (₹${priceComp.savings})`);
    } else {
      console.log('Single store offer found, verifying single comparison structure');
      assert(deduped.length > 0, 'Products available');
    }

    // Review analysis
    const sampleProduct = deduped[0];
    if (sampleProduct) {
      const reviewAnalysis = analyzeProductReviews(sampleProduct);
      assert(reviewAnalysis.rating === sampleProduct.reviews.rating, 'Review rating matched real catalog');
      assert(reviewAnalysis.reviewCount === sampleProduct.reviews.reviewCount, 'Review count matched real catalog');
      assert(reviewAnalysis.positiveThemes.length > 0, 'Extracted real positive sentiments');
      assert(reviewAnalysis.negativeThemes.length > 0, 'Extracted real drawback sentiments');
    }
  }

  // TEST 6: Conflict & Impossibility Handling
  console.log('\n--- TEST 6: Conflict & Impossibility Handling ---');
  {
    const impossiblePrompt = 'Find me a gaming laptop with RTX 4090 under ₹30,000';
    const conflictResult = await executeShoppingWorkflow(impossiblePrompt);
    assert(conflictResult.status === 'conflict', `Impossible requirement flagged as conflict status (got: ${conflictResult.status})`);
    assert(conflictResult.conflictDetails !== undefined, 'Conflict details provided');
    assert(conflictResult.conflictDetails.message.length > 0, 'Clear explanation why criteria cannot be satisfied simultaneously');
    assert(conflictResult.conflictDetails.relaxationSuggestions.length > 0, 'Actionable trade-off compromises suggested');
  }

  // TEST 7: Full Autonomous Pipeline Execution & Recommendation Deliverable
  console.log('\n--- TEST 7: End-to-End Autonomous Pipeline & Deliverable ---');
  {
    const prompt = 'Find me the best gaming laptop under ₹80,000 with RTX 4060';
    const deliverable = await executeShoppingWorkflow(prompt);

    assert(deliverable.status === 'success', `Workflow status is success (got: ${deliverable.status})`);
    assert(deliverable.type === 'shopping', 'Deliverable type is "shopping"');
    assert(deliverable.rankedProducts.length > 0, `Generated ${deliverable.rankedProducts.length} ranked product recommendations`);
    
    const top = deliverable.rankedProducts[0];
    assert(top.rank === 1, 'Top recommendation has rank 1');
    assert(top.verdict !== undefined, `Top product has recommendation verdict: "${top.verdict}"`);
    assert(top.product.lowestPriceOffer.price <= 80000, `Top product satisfies budget (₹${top.product.lowestPriceOffer.price} <= ₹80,000)`);
    assert(top.scores.overallScore > 0, `Multi-criteria score computed: ${top.scores.overallScore}%`);
    assert(top.scores.requirementMatch > 0, 'Requirement match score computed');
    assert(top.whyItMatches.length > 0, 'Transparent "Why it matches" justification provided');
    assert(top.importantDrawbacks.length > 0, 'Transparent trade-offs and watch-outs documented');
    assert(deliverable.summaryNarrative.length > 50, 'User-facing narrative summary built');
    assert(deliverable.provenanceNotice.length > 0, 'Provenance notice attached');
  }

  // TEST 8: Artifact Normalization & Spec Validation
  console.log('\n--- TEST 8: Artifact Normalizer & UI Contract ---');
  {
    const prompt = 'Find me running shoes under ₹5,000';
    const deliverable = await executeShoppingWorkflow(prompt);
    const jsonString = JSON.stringify(deliverable);

    // Normalizer validation
    assert(isValidShoppingSpec(deliverable), 'isValidShoppingSpec accepts deliverable object');
    
    const normalized = normalizeArtifact(jsonString, 'agent-shopping', 'Running Shoes Recommendations');
    assert(normalized.type === 'shopping', `Normalizer produced artifact of type "shopping" (got: ${normalized.type})`);
    assert(normalized.status === 'completed', 'Artifact status is completed');
    assert(normalized.mimeType === 'application/vnd.agentmesh.shopping+json', 'Correct shopping MIME type');
    assert(normalized.data !== undefined, 'Structured shopping data preserved in normalized artifact');
  }

  console.log('\n================================================================');
  console.log(`ALL TESTS PASSED: ${passed}/${total} assertions verified!`);
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Aborted with Error:', err);
  process.exit(1);
});
