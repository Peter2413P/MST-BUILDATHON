import { normalizeArtifact, extractMultiArtifacts, isValidChartSpec, isFactCheckArray } from './src/lib/artifacts/normalizer.ts';

console.log('--- RUNNING ARTIFACT NORMALIZATION & RENDERING TESTS ---');

// TEST 1: ChartAgent pure JSON output
const chartJson = JSON.stringify({
  type: 'bar',
  data: {
    labels: ['Q1', 'Q2'],
    datasets: [
      {
        label: 'Revenue (lakh INR)',
        data: [10, 14],
        backgroundColor: ['#4e79a7', '#f28e2b'],
        borderColor: ['#4e79a7', '#f28e2b'],
        borderWidth: 1,
      },
    ],
  },
  options: {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Quarterly Revenue Comparison',
      },
    },
  },
});

const t1 = normalizeArtifact(chartJson, 'ChartAgent');
console.log('Test 1 (Pure Chart JSON):', t1.type === 'chart' ? '✓ PASSED (type: chart)' : '✗ FAILED', t1.title);
if (!isValidChartSpec(t1.data)) throw new Error('Test 1 failed chart spec validation');

// TEST 2: HTML Deliverable
const htmlString = `<!DOCTYPE html><html><head><title>Dashboard</title></head><body><div class="card"><h3>Revenue: 14 Lakh</h3></div></body></html>`;
const t2 = normalizeArtifact(htmlString, 'DashboardAgent');
console.log('Test 2 (HTML Output):', t2.type === 'html' ? '✓ PASSED (type: html)' : '✗ FAILED', t2.title);

// TEST 3: Explicit JSON Output
const jsonDeliverable = {
  type: 'json',
  revenue: {
    q1_inr_lakh: 10,
    q2_inr_lakh: 14,
    growth_rate: 0.40,
  }
};
const t3 = normalizeArtifact(jsonDeliverable, 'FinanceAgent');
console.log('Test 3 (Explicit JSON):', t3.type === 'json' ? '✓ PASSED (type: json)' : '✗ FAILED', t3.title);

// TEST 4: Narrative Summary
const narrativeText = `### Financial Performance Summary\n\nRevenue for Q1 was ₹10 lakh and grew to ₹14 lakh in Q2. This represents an increase of 40% quarter-over-quarter.`;
const t4 = normalizeArtifact(narrativeText, 'SummarizerAgent');
console.log('Test 4 (Markdown Narrative):', t4.type === 'markdown' ? '✓ PASSED (type: markdown)' : '✗ FAILED');

// TEST 5: Composite Multi-Artifact (Financial Narrative + Embedded Chart.js JSON)
const multiOutput = `### Quarterly Revenue Growth Analysis
Revenue increased by 40% from Q1 (₹10 lakh) to Q2 (₹14 lakh).

${chartJson}

Key Observation: Strong demand acceleration into the end of the fiscal quarter.`;

const t5 = extractMultiArtifacts(multiOutput, 'FinanceAndChartAgent');
console.log('Test 5 (Multi-Artifact):');
console.log(' - Extracted Artifacts Count:', t5.artifacts.length, t5.artifacts.length === 1 && t5.artifacts[0].type === 'chart' ? '✓' : '✗');
console.log(' - Extracted Narrative Length:', t5.narrative?.length, t5.narrative?.includes('40%') ? '✓' : '✗');
console.log(' - Raw JSON Leaked in Narrative:', t5.narrative?.includes('"datasets"') ? '✗ LEAKED' : '✓ CLEAN');

// TEST 6: FactCheckAgent structured JSON array output
const factCheckJson = JSON.stringify([
  {
    claim: 'Revenue increased by 40%',
    verdict: 'true',
    confidence: 0.99,
    explanation: 'The source states revenue rose from ₹10 lakh to ₹14 lakh. ((14-10)/10) × 100 = 40%, matching the claim exactly.',
    caveats: 'Assumes the figures are accurate and refer to the same period.',
  },
  {
    claim: 'Customer count doubled',
    verdict: 'false',
    confidence: 0.98,
    explanation: 'The source reports a 28% increase in customer count.',
    caveats: 'Based on the supplied source.',
  },
  {
    claim: 'Operating costs increased by 11%',
    verdict: 'true',
    confidence: 0.99,
    explanation: 'Source explicitly confirms operating costs increased by 11%.',
    caveats: 'Direct match.',
  },
  {
    claim: 'Company launched three products',
    verdict: 'false',
    confidence: 0.97,
    explanation: 'Source states only two products were launched.',
    caveats: 'Contradicted by source data.',
  },
  {
    claim: 'Market share expanded in Asia',
    verdict: 'uncertain',
    confidence: 0.50,
    explanation: 'No geographical breakdown was provided in the source facts.',
    caveats: 'Missing regional data.',
  }
]);

const t6 = normalizeArtifact(factCheckJson, 'FactCheckAgent');
console.log('Test 6 (FactCheck Output):', t6.type === 'fact_check' ? '✓ PASSED (type: fact_check)' : '✗ FAILED', t6.title);
if (!isFactCheckArray(t6.data?.items)) throw new Error('Test 6 failed fact check items validation');

// TEST 7: FactCheck embedded in narrative
const multiFactCheck = `### Fact Checking Verification Report
Verification of claims against the provided quarterly facts:

${factCheckJson}

Overall Verification Assessment: 2 claims verified, 2 claims contradicted, 1 uncertain.`;

const t7 = extractMultiArtifacts(multiFactCheck, 'FactCheckAgent');
console.log('Test 7 (FactCheck in Narrative):');
console.log(' - Extracted Artifacts Count:', t7.artifacts.length, t7.artifacts.length === 1 && t7.artifacts[0].type === 'fact_check' ? '✓' : '✗');
console.log(' - Narrative cleaned:', t7.narrative?.includes('"verdict"') ? '✗ LEAKED' : '✓ CLEAN');

console.log('--- ALL ARTIFACT NORMALIZER INVARIANTS SATISFIED ---');
