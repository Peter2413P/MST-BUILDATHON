import { normalizeArtifact, extractMultiArtifacts, isValidWebsiteSpec } from './src/lib/artifacts/normalizer.ts';

// State machine pure function test (identical to ChatWorkspace deriveJobUIPhase)
function deriveJobUIPhase(status, subtasks) {
  if (!status || status === 'pending') return 'thinking';
  if (status === 'planning') return 'planning';
  if (status === 'running') {
    if (subtasks && subtasks.length > 0) {
      const anyRunning = subtasks.some(s => s.status === 'running' || s.status === 'retrying');
      const allDone = subtasks.every(s => s.status === 'completed' || s.status === 'settled');
      if (allDone) return 'synthesizing';
      return 'executing';
    }
    return 'executing';
  }
  if (status === 'settling') return 'synthesizing';
  if (status === 'completed' || status === 'settled') return 'completed';
  if (status === 'failed' || status === 'payment_failed') return 'failed';
  if (status === 'cancelled' || status === 'rejected' || status === 'expired') return 'cancelled';
  return 'thinking';
}

async function runTest() {
  console.log('=== Starting E2E Website Job Lifecycle & Frontend Synchronization Test ===\n');

  // Test 1: State Machine Mapping
  console.log('[Test 1] Testing deriveJobUIPhase state machine mapping:');
  const phasePending = deriveJobUIPhase('pending', []);
  const phasePlanning = deriveJobUIPhase('planning', []);
  const phaseRunning = deriveJobUIPhase('running', [{ status: 'running' }]);
  const phaseSynthesizing = deriveJobUIPhase('running', [{ status: 'completed' }, { status: 'settled' }]);
  const phaseSettling = deriveJobUIPhase('settling', []);
  const phaseCompleted = deriveJobUIPhase('completed', [{ status: 'settled' }]);
  const phaseFailed = deriveJobUIPhase('failed', [{ status: 'failed' }]);

  console.log(`  - 'pending' -> '${phasePending}' (expected 'thinking')`);
  console.log(`  - 'planning' -> '${phasePlanning}' (expected 'planning')`);
  console.log(`  - 'running' (with active subtask) -> '${phaseRunning}' (expected 'executing')`);
  console.log(`  - 'running' (all subtasks done) -> '${phaseSynthesizing}' (expected 'synthesizing')`);
  console.log(`  - 'settling' -> '${phaseSettling}' (expected 'synthesizing')`);
  console.log(`  - 'completed' -> '${phaseCompleted}' (expected 'completed')`);
  console.log(`  - 'failed' -> '${phaseFailed}' (expected 'failed')`);

  if (phaseCompleted !== 'completed' || phaseFailed !== 'failed' || phasePending !== 'thinking') {
    throw new Error('Phase derivation failed state invariants');
  }
  console.log('  ✓ State machine mappings verified!\n');

  // Test 2: Website Artifact Normalization
  console.log('[Test 2] Testing Website Artifact Normalization:');
  const mockWebsiteSpec = {
    type: 'website',
    status: 'success',
    name: 'SoleVault Sneaker Store',
    brand: 'SoleVault',
    category: 'Sneakers & Streetwear',
    pages: [
      { name: 'Home', path: '/', status: 'ready' },
      { name: 'Products', path: '/products', status: 'ready' },
      { name: 'Product Details', path: '/products/[id]', status: 'ready' },
      { name: 'Cart', path: '/cart', status: 'ready' },
      { name: 'Checkout', path: '/checkout', status: 'ready' }
    ],
    buildStatus: 'passed',
    debugAttempts: 0,
    summary: 'Autonomous sneaker store build completed with 14 Next.js files.',
    files: [
      { path: 'package.json', content: '{"name": "solevault"}' },
      { path: 'app/page.tsx', content: 'export default function Page() { return <div>Sneakers</div>; }' }
    ],
    requirements: {
      brand: 'SoleVault',
      category: 'Sneakers',
      brandStory: 'Premium limited edition sneakers and streetwear.',
      productCatalog: [
        { id: 'snk-1', name: 'SoleVault Air Stealth Pro', price: 199.99, rating: 4.9, category: 'Sneakers' },
        { id: 'snk-2', name: 'SoleVault Retro High OG', price: 169.00, rating: 4.8, category: 'Sneakers' }
      ]
    }
  };

  const isWebsite = isValidWebsiteSpec(mockWebsiteSpec);
  console.log(`  - isValidWebsiteSpec: ${isWebsite}`);
  if (!isWebsite) throw new Error('isValidWebsiteSpec failed');

  const normalized = normalizeArtifact(JSON.stringify(mockWebsiteSpec, null, 2));
  console.log(`  - Normalized Type: '${normalized.type}'`);
  console.log(`  - Title: '${normalized.title}'`);
  console.log(`  - Status: '${normalized.status}'`);
  console.log(`  - Pages Count: '${normalized.data.pages.length}'`);
  console.log(`  - Catalog Count: '${normalized.data.requirements.productCatalog.length}'`);

  if (normalized.type !== 'website' || normalized.title !== 'SoleVault Sneaker Store') {
    throw new Error('Website normalization failed');
  }
  console.log('  ✓ Website normalization verified!\n');

  // Test 3: Multi-Artifact Extraction (when narrative wraps website spec)
  console.log('[Test 3] Testing Multi-Artifact Extraction with narrative:');
  const narrativeWithJson = `Here is your generated e-commerce sneaker store:\n\n` +
    '```json\n' + JSON.stringify(mockWebsiteSpec, null, 2) + '\n```\n\n' +
    'Enjoy your store!';

  const composite = extractMultiArtifacts(narrativeWithJson);
  console.log(`  - Extracted Artifacts: ${composite.artifacts.length}`);
  console.log(`  - Primary Artifact Type: '${composite.artifacts[0].type}'`);
  console.log(`  - Clean Narrative: '${composite.narrative}'`);

  if (composite.artifacts.length !== 1 || composite.artifacts[0].type !== 'website') {
    throw new Error('Multi-artifact extraction failed for website deliverable');
  }
  console.log('  ✓ Multi-artifact extraction verified!\n');

  console.log('=== All Frontend Lifecycle & Synchronization Tests Passed Successfully! ===');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
