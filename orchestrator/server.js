require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { getDb } = require('./db');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/agents', require('./routes/agents'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/metrics', require('./routes/metrics'));
app.use('/api/transactions', require('./routes/transactions'));

app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now(), network: 'mst-testnet' }));

const AGENTS_SEED = [
  { id: 'agent-summarizer',   name: 'SummarizerAgent',   skill: 'summarizer',   description: 'Summarize text/articles into concise insights', price_usdc: 0.005, price_unit: 'paragraph', base_url: 'http://localhost:4001', wallet_address: '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7' },
  { id: 'agent-code-review',  name: 'CodeReviewAgent',   skill: 'code-review',  description: 'Review & suggest fixes for code diffs and repos', price_usdc: 0.02, price_unit: '10 lines', base_url: 'http://localhost:4002', wallet_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
  { id: 'agent-research',     name: 'ResearchAgent',     skill: 'research',     description: 'Deep web research + citation gathering', price_usdc: 0.01, price_unit: 'query', base_url: 'http://localhost:4003', wallet_address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
  { id: 'agent-translate',    name: 'TranslateAgent',    skill: 'translate',    description: 'Multi-language translation with context preservation', price_usdc: 0.005, price_unit: '100 words', base_url: 'http://localhost:4004', wallet_address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' },
  { id: 'agent-sentiment',    name: 'SentimentAgent',    skill: 'sentiment',    description: 'Sentiment & emotion tagging with confidence scoring', price_usdc: 0.002, price_unit: 'item', base_url: 'http://localhost:4005', wallet_address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65' },
  { id: 'agent-sql',          name: 'SQLAgent',          skill: 'sql',          description: 'Natural language → production SQL queries', price_usdc: 0.015, price_unit: 'query', base_url: 'http://localhost:4006', wallet_address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc' },
  { id: 'agent-chart',        name: 'ChartAgent',        skill: 'chart',        description: 'Raw data → Chart.js visualization specifications', price_usdc: 0.01, price_unit: 'chart', base_url: 'http://localhost:4007', wallet_address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9' },
  { id: 'agent-extract',      name: 'ExtractAgent',      skill: 'extract',      description: 'Structured data extraction from documents and text', price_usdc: 0.005, price_unit: 'doc', base_url: 'http://localhost:4008', wallet_address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955' },
  { id: 'agent-legal-review', name: 'LegalReviewAgent',  skill: 'legal-review', description: 'Flag risky clauses & liability traps in contracts', price_usdc: 0.02, price_unit: 'page', base_url: 'http://localhost:4009', wallet_address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f' },
  { id: 'agent-finance',      name: 'FinanceAgent',      skill: 'finance',      description: 'Financial ratio analysis & KPI summary generation', price_usdc: 0.015, price_unit: 'report', base_url: 'http://localhost:4010', wallet_address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720' },
  { id: 'agent-transcribe',   name: 'TranscribeAgent',   skill: 'transcribe',   description: 'Audio recordings → timestamped text transcripts', price_usdc: 0.01, price_unit: 'minute', base_url: 'http://localhost:4011', wallet_address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096' },
  { id: 'agent-fact-check',   name: 'FactCheckAgent',    skill: 'fact-check',   description: 'Cross-reference claims against trusted sources', price_usdc: 0.01, price_unit: 'claim', base_url: 'http://localhost:4012', wallet_address: '0x71bE63f3384f5fb98995451bE4f258f792397013' },
];

async function seedRegistry() {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) as n FROM agents').get();
  if (existing.n > 0) return;

  console.log('[Seed] Seeding MST agent registry...');
  const insert = db.prepare(`
    INSERT OR IGNORE INTO agents (id, name, skill, description, price_usdc, price_unit, wallet_id, wallet_address, base_url, bond_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.1)
  `);

  for (const a of AGENTS_SEED) {
    insert.run(a.id, a.name, a.skill, a.description, a.price_usdc, a.price_unit,
      `mst_wallet_${a.id}`, a.wallet_address, a.base_url);
    console.log(`[Seed] Registered ${a.name} (${a.wallet_address}) - ${a.price_usdc} MSTC`);
  }
  console.log('[Seed] Agent registry seeded with MST Testnet wallets.');
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  console.log(`[Orchestrator] Running on http://localhost:${PORT}`);
  await seedRegistry();
});
