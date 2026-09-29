import { query, exec, initSchema, flushNow } from './db';

const AGENTS_SEED = [
  {
    id: 'agent-summarizer',
    name: 'SummarizerAgent',
    skill: 'summarizer',
    description: 'Summarize text/articles into concise insights',
    price_usdc: 0.005,
    price_unit: 'paragraph',
    wallet_address: '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
  },
  {
    id: 'agent-code-review',
    name: 'CodeReviewAgent',
    skill: 'code-review',
    description: 'Review & suggest fixes for code diffs and repos',
    price_usdc: 0.02,
    price_unit: '10 lines',
    wallet_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  },
  {
    id: 'agent-research',
    name: 'ResearchAgent',
    skill: 'research',
    description: 'Deep web research + citation gathering',
    price_usdc: 0.01,
    price_unit: 'query',
    wallet_address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  },
  {
    id: 'agent-translate',
    name: 'TranslateAgent',
    skill: 'translate',
    description: 'Multi-language translation with context preservation',
    price_usdc: 0.005,
    price_unit: '100 words',
    wallet_address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  },
  {
    id: 'agent-sentiment',
    name: 'SentimentAgent',
    skill: 'sentiment',
    description: 'Sentiment & emotion tagging with confidence scoring',
    price_usdc: 0.002,
    price_unit: 'item',
    wallet_address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
  },
  {
    id: 'agent-sql',
    name: 'SQLAgent',
    skill: 'sql',
    description: 'Natural language → production SQL queries',
    price_usdc: 0.015,
    price_unit: 'query',
    wallet_address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
  },
  {
    id: 'agent-chart',
    name: 'ChartAgent',
    skill: 'chart',
    description: 'Raw data → Chart.js visualization specifications',
    price_usdc: 0.01,
    price_unit: 'chart',
    wallet_address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
  },
  {
    id: 'agent-extract',
    name: 'ExtractAgent',
    skill: 'extract',
    description: 'Structured data extraction from documents and text',
    price_usdc: 0.005,
    price_unit: 'doc',
    wallet_address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
  },
  {
    id: 'agent-legal-review',
    name: 'LegalReviewAgent',
    skill: 'legal-review',
    description: 'Flag risky clauses & liability traps in contracts',
    price_usdc: 0.02,
    price_unit: 'page',
    wallet_address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',
  },
  {
    id: 'agent-finance',
    name: 'FinanceAgent',
    skill: 'finance',
    description: 'Financial ratio analysis & KPI summary generation',
    price_usdc: 0.015,
    price_unit: 'report',
    wallet_address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
  },
  {
    id: 'agent-transcribe',
    name: 'TranscribeAgent',
    skill: 'transcribe',
    description: 'Audio recordings → timestamped text transcripts',
    price_usdc: 0.01,
    price_unit: 'minute',
    wallet_address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
  },
  {
    id: 'agent-fact-check',
    name: 'FactCheckAgent',
    skill: 'fact-check',
    description: 'Cross-reference claims against trusted sources',
    price_usdc: 0.01,
    price_unit: 'claim',
    wallet_address: '0x71bE63f3384f5fb98995451bE4f258f792397013',
  },
  {
    id: 'agent-ecommerce-builder',
    name: 'ECommerceWebsiteBuilderAgent',
    skill: 'ecommerce-builder',
    description: 'Autonomous agent that plans, designs, builds, tests, debugs, and delivers production-ready e-commerce websites.',
    price_usdc: 0.05,
    price_unit: 'website',
    wallet_address: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
  },
  {
    id: 'agent-shopping',
    name: 'Shopping Agent',
    skill: 'shopping',
    description: 'Autonomous product discovery, multi-retailer price comparison, review sentiment analysis, and transparent recommendation agent.',
    price_usdc: 0.02,
    price_unit: 'recommendation',
    wallet_address: '0x324462bf424031a02e5319803185903218590321',
  },
  {
    id: 'agent-product-discovery',
    name: 'ProductDiscoveryAgent',
    skill: 'product-discovery',
    description: 'Queries live and verified multi-retailer catalog feeds for genuine product listings.',
    price_usdc: 0.01,
    price_unit: 'discovery',
    wallet_address: '0x18F421C0469b4F24a919421A4B0243198A419241',
  },
  {
    id: 'agent-price-comparison',
    name: 'PriceComparisonAgent',
    skill: 'price-comparison',
    description: 'Deduplicates identical products across retailers and determines genuine price variance.',
    price_usdc: 0.005,
    price_unit: 'comparison',
    wallet_address: '0x29E414B9294241B0469b4F24a919421A4B024319',
  },
  {
    id: 'agent-review-analysis',
    name: 'ReviewAnalysisAgent',
    skill: 'review-analysis',
    description: 'Evaluates customer sentiment, verified review reliability, positives, and drawbacks.',
    price_usdc: 0.005,
    price_unit: 'analysis',
    wallet_address: '0x59B19414B9294241B0469b4F24a919421A4B0243',
  },
  {
    id: 'agent-product-ranking',
    name: 'ProductRankingAgent',
    skill: 'product-ranking',
    description: 'Applies deterministic hard requirement filtering and multi-criteria transparent scoring.',
    price_usdc: 0.005,
    price_unit: 'ranking',
    wallet_address: '0x71A0243198A419241B0469b4F24a919421A4B024',
  },
];

let seeded = false;

export async function ensureSeeded() {
  if (seeded) return;
  await initSchema();

  console.log('[Seed] Ensuring MST agent registry is up to date...');
  for (const a of AGENTS_SEED) {
    await exec(
      `INSERT OR IGNORE INTO agents (id, name, skill, description, price_usdc, price_unit, wallet_id, wallet_address, base_url, bond_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.1)`,
      [
        a.id,
        a.name,
        a.skill,
        a.description,
        a.price_usdc,
        a.price_unit,
        `mst_wallet_${a.id}`,
        a.wallet_address,
        'http://localhost',
      ]
    );
  }
  seeded = true;
  await flushNow();
  console.log('[Seed] Done: Agents seeded with MST testnet wallets.');
}
