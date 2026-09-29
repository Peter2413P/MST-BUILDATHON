import { executeEcommerceBuilder } from './src/lib/server/ecommerce/orchestrator.ts';
import { WorkspaceValidationProvider } from './src/lib/server/ecommerce/providers/validation-provider.ts';
import { AutonomousDebugProvider } from './src/lib/server/ecommerce/providers/debug-provider.ts';
import { normalizeArtifact, isValidWebsiteSpec } from './src/lib/artifacts/normalizer.ts';
import { decomposeJob } from './src/lib/server/planner.ts';

console.log('================================================================');
console.log('TESTING ECOMMERCE WEBSITE BUILDER AGENT & REGISTRY INTEGRATION');
console.log('================================================================\n');

async function runTests() {
  // TEST 1: Semantic Agent Discovery / Decomposition
  console.log('--- TEST 1: Semantic Agent Discovery & Capability Matching ---');
  const mockAgentRegistry = [
    { skill: 'summarizer', name: 'SummarizerAgent', description: 'Summarize text/articles into concise insights', price_usdc: 0.005 },
    { skill: 'research', name: 'ResearchAgent', description: 'Deep web research + citation gathering', price_usdc: 0.01 },
    { skill: 'ecommerce-builder', name: 'ECommerceWebsiteBuilderAgent', description: 'Autonomous agent that plans, designs, builds, tests, debugs, and delivers production-ready e-commerce websites.', price_usdc: 0.05 },
    { skill: 'fact-check', name: 'FactCheckAgent', description: 'Cross-reference claims against trusted sources', price_usdc: 0.01 },
  ];

  const plan1 = await decomposeJob(
    "Build a modern fashion e-commerce website for a men's clothing brand called HUSTLR. It should contain a homepage, product listing, product details, cart, checkout UI, search, category filtering, responsive mobile design and a dark premium visual style.",
    mockAgentRegistry
  );

  const matchedSkill1 = plan1.subtasks[0]?.skill;
  console.log('Discovery Query 1 matched skill:', matchedSkill1);
  if (matchedSkill1 !== 'ecommerce-builder') {
    throw new Error(`Expected ecommerce-builder skill, got: ${matchedSkill1}`);
  }
  console.log('✓ TEST 1 PASSED: Successfully matched ECommerceWebsiteBuilderAgent.\n');

  // TEST 2: Autonomous Multi-Stage E-Commerce Website Builder Execution
  console.log('--- TEST 2: Autonomous 7-Stage Workflow Execution ---');
  const testPrompt = `Build a premium dark-themed men's fashion e-commerce website called HUSTLR.
Requirements:
- Next.js + TypeScript
- responsive desktop and mobile UI
- premium dark visual design
- homepage
- product catalogue
- category filtering
- product details
- shopping cart
- checkout page
- search
- 8 mock products
- reusable product cards
- responsive navigation
- modern typography
- polished animations`;

  const buildResult = await executeEcommerceBuilder(testPrompt, undefined, 'test_hustlr_job_001');

  console.log('Build Result Status:', buildResult.status);
  console.log('Brand:', buildResult.brand);
  console.log('Category:', buildResult.category);
  console.log('Generated Pages Count:', buildResult.pages.length);
  console.log('Generated Files Count:', buildResult.files.length);
  console.log('Build Status:', buildResult.buildStatus);
  console.log('Debug Attempts:', buildResult.debugAttempts);

  if (buildResult.status !== 'success' || buildResult.buildStatus !== 'passed') {
    throw new Error(`Build failed: ${JSON.stringify(buildResult.logs)}`);
  }
  if (buildResult.files.length < 10) {
    throw new Error(`Expected at least 10 generated files, got ${buildResult.files.length}`);
  }
  console.log('✓ TEST 2 PASSED: Successfully generated multi-file Next.js application.\n');

  // TEST 3: Autonomous Debugger Diagnosis & Auto-Patching
  console.log('--- TEST 3: Autonomous Debugger Auto-Repair ---');
  const testFilesWithSyntaxError = [
    {
      path: 'package.json',
      content: '{"name": "broken-test", "version": "1.0.0", "dependencies": {}}',
    },
    {
      path: 'tsconfig.json',
      content: '{"compilerOptions": {}}',
    },
    {
      path: 'app/layout.tsx',
      content: 'export default function RootLayout({ children }: { children: any }) { return <html><body>{children}</body></html>; }',
    },
    {
      path: 'app/page.tsx',
      content: 'export default function HomePage() { return <div>Broken Unclosed Brace', // Deliberate unbalanced brace
    },
    {
      path: 'types/store.ts',
      content: 'export interface Product { id: string; }',
    },
    {
      path: 'data/products.ts',
      content: 'export const PRODUCTS = [];',
    },
    {
      path: 'components/Navbar.tsx',
      content: 'export default function Navbar() { return <nav>Nav</nav>; }',
    },
    {
      path: 'components/ProductCard.tsx',
      content: 'export default function ProductCard() { return <div>Card</div>; }',
    },
  ];

  const validator = new WorkspaceValidationProvider();
  const initialValidation = await validator.validate(testFilesWithSyntaxError, 'test_debug_job_002');
  console.log('Initial Validation Passed (Should be false due to broken brace):', initialValidation.passed);
  console.log('Detected Issues Count:', initialValidation.issues.length);

  if (initialValidation.passed) {
    throw new Error('Expected validation to fail on intentional syntax error');
  }

  const debuggerProvider = new AutonomousDebugProvider();
  const debugResult = await debuggerProvider.diagnoseAndRepair({
    files: testFilesWithSyntaxError,
    requirements: buildResult.requirements,
    designSpec: buildResult.designSpec,
    validationIssues: initialValidation.issues,
    attemptNumber: 1,
    maxAttempts: 3,
  });

  console.log('Debugger Repaired:', debugResult.repaired);
  console.log('Diagnostic Summary:', debugResult.diagnosticSummary);
  console.log('Fixes Applied:', debugResult.fixesApplied);

  const reValidation = await validator.validate(debugResult.patchedFiles, 'test_debug_job_002');
  console.log('Re-Validation Passed After Auto-Patching:', reValidation.passed);

  if (!reValidation.passed) {
    throw new Error('Re-validation failed after debugger patch');
  }
  console.log('✓ TEST 3 PASSED: Autonomous Debugger successfully repaired syntax issue.\n');

  // TEST 4: Artifact Normalization & Rendering Contract
  console.log('--- TEST 4: Artifact Normalization for Website Deliverables ---');
  const normalized = normalizeArtifact(buildResult, 'ECommerceWebsiteBuilderAgent');
  console.log('Normalized Artifact Type:', normalized.type);
  console.log('Normalized Title:', normalized.title);
  console.log('Normalized MIME Type:', normalized.mimeType);

  if (normalized.type !== 'website') {
    throw new Error(`Expected normalized type "website", got "${normalized.type}"`);
  }
  if (!isValidWebsiteSpec(normalized.data)) {
    throw new Error('Normalized data failed isValidWebsiteSpec');
  }
  console.log('✓ TEST 4 PASSED: Website artifact correctly classified and normalized.\n');

  console.log('================================================================');
  console.log('ALL E-COMMERCE BUILDER INVARIANTS AND ACCEPTANCE TESTS PASSED!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
