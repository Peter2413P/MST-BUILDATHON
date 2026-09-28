'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getAgent } from '@/lib/api';
import type { Agent } from '@/lib/types';

const SKILL_META: Record<
  string,
  {
    emoji: string;
    tagline: string;
    capability: string;
    inputLabel: string;
    exampleInput: string;
    exampleOutput: string;
    acceptsFiles: boolean;
    fileHint: string;
  }
> = {
  summarizer: {
    emoji: '📝',
    tagline: 'Condense any text into crisp, structured summaries.',
    capability:
      'Accepts articles, reports, or raw text. Returns bullet-point or prose summaries preserving key facts, numbers, and conclusions.',
    inputLabel: 'Paste text or describe what to summarize',
    exampleInput: 'Summarize the latest research on decentralized AI compute and autonomous agent payments.',
    exampleOutput:
      '**Summary:** Decentralized compute enables autonomous AI agents to negotiate, execute, and settle services on-chain without human intermediaries using EVM micropayments on MST Blockchain.',
    acceptsFiles: true,
    fileHint: 'Upload a .txt or .md file',
  },
  'code-review': {
    emoji: '🔍',
    tagline: 'Find bugs, security vulnerabilities, and optimizations in your code.',
    capability:
      'Reads code in any language. Returns numbered findings with severity (critical/major/minor) and actionable code fixes.',
    inputLabel: 'Paste code or describe what to review',
    exampleInput:
      'def bubble_sort(arr):\n    for i in range(len(arr)):\n        for j in range(len(arr)-i):\n            if arr[j] > arr[j+1]:\n                arr[j], arr[j+1] = arr[j+1], arr[j]',
    exampleOutput:
      '1. [Critical] Line 3: `range(len(arr)-i)` → IndexError on last pass. Fix: `range(len(arr)-i-1)`.\n2. [Optimization] Add an early-exit swap flag to reach O(n) on sorted arrays.\n3. [Style] Add Python type hints.',
    acceptsFiles: true,
    fileHint: 'Upload a code file (.py, .js, .ts, etc.)',
  },
  research: {
    emoji: '🔬',
    tagline: 'Deep-dive research with cited sources and structured reports.',
    capability: 'Produces an in-depth report with Overview, Key Findings, Data Points, and Conclusion.',
    inputLabel: 'Describe what you need researched',
    exampleInput: 'Research the current state of AI agent payment protocols on MST Blockchain.',
    exampleOutput:
      '**Research Report: AI Agent Payment Protocols**\n\n**Overview:** Autonomous agents require instant, low-latency settlement.\n\n**Key Findings:**\n- MST Blockchain provides EVM compatibility with 18-decimal $MSTC native settlement.\n- AgentMesh enables subtask decomposition and on-chain escrow release.\n\n**Conclusion:** MST Blockchain is an optimal settlement layer for decentralized agent economies.',
    acceptsFiles: false,
    fileHint: '',
  },
  translate: {
    emoji: '🌐',
    tagline: 'Accurate translation preserving tone, formatting, and technical terms.',
    capability:
      'Detects source language automatically. Specify target language in brackets like [to: Spanish]. Returns clean translation.',
    inputLabel: 'Enter text to translate (add [to: Language] for target)',
    exampleInput: 'The decentralized agent marketplace settles payments in MSTC on MST Blockchain. [to: Spanish]',
    exampleOutput: 'El mercado de agentes descentralizado liquida pagos en MSTC en MST Blockchain.',
    acceptsFiles: true,
    fileHint: 'Upload a text file to translate',
  },
  sentiment: {
    emoji: '💭',
    tagline: 'Sentiment and emotion tagging with confidence scores.',
    capability: 'Returns JSON with overall sentiment, score (-1 to +1), detected emotions, and reasoning.',
    inputLabel: 'Enter text to analyze',
    exampleInput:
      'The agent marketplace was extremely responsive and the on-chain settlement on MST Blockchain went through smoothly.',
    exampleOutput:
      '{\n  "overall": "positive",\n  "score": 0.94,\n  "emotions": ["enthusiasm", "satisfaction"],\n  "confidence": 0.98,\n  "reasoning": "High praise for responsiveness and blockchain settlement"\n}',
    acceptsFiles: true,
    fileHint: 'Upload a .txt file of reviews',
  },
  sql: {
    emoji: '🗃️',
    tagline: 'Natural language → production-ready SQL queries.',
    capability: 'Converts plain-English queries to valid PostgreSQL/SQLite with explanations.',
    inputLabel: 'Describe the query you need',
    exampleInput: 'List the top 10 agents by total MSTC earned this month, including job count.',
    exampleOutput:
      '```sql\nSELECT a.name, a.skill,\n       SUM(t.amount_usdc) AS total_earned_mstc,\n       COUNT(DISTINCT t.job_id) AS job_count,\n       a.avg_quality\nFROM agents a\nJOIN transactions t ON t.agent_id = a.id\nGROUP BY a.id ORDER BY total_earned_mstc DESC LIMIT 10;\n```',
    acceptsFiles: false,
    fileHint: '',
  },
  chart: {
    emoji: '📊',
    tagline: 'Turn raw data into visualization specs.',
    capability: 'Accepts data descriptions or tables. Returns Chart.js / JSON configuration.',
    inputLabel: 'Describe your data and desired chart',
    exampleInput: 'Agent earnings: research 0.05 MSTC, code-review 0.04 MSTC, summarizer 0.02 MSTC. Bar chart.',
    exampleOutput:
      '```json\n{\n  "type": "bar",\n  "data": {\n    "labels": ["research","code-review","summarizer"],\n    "datasets": [{"label":"MSTC Earned","data":[0.05,0.04,0.02],"backgroundColor":"#ef9f27"}]\n  }\n}\n```',
    acceptsFiles: false,
    fileHint: '',
  },
  extract: {
    emoji: '⛏️',
    tagline: 'Structured data extraction from documents or HTML.',
    capability: 'Identifies and extracts entities, dates, amounts, and relationships into clean JSON.',
    inputLabel: 'Paste document text or HTML',
    exampleInput: 'Invoice from AI Agent Labs. Date: Oct 1 2026. Total: 0.50 MSTC.',
    exampleOutput:
      '```json\n{\n  "vendor": "AI Agent Labs",\n  "date": "2026-10-01",\n  "total": "0.50",\n  "currency": "MSTC"\n}\n```',
    acceptsFiles: true,
    fileHint: 'Upload a document (.txt, .csv, .html)',
  },
  'legal-review': {
    emoji: '⚖️',
    tagline: 'Flag risky clauses in contracts before signing.',
    capability: 'Reviews contracts for liability traps, IP ownership issues, and missing protections.',
    inputLabel: 'Paste contract text or clauses to review',
    exampleInput: 'This agreement shall automatically renew unless either party provides sixty (60) days notice.',
    exampleOutput:
      '🟡 **Medium Risk — Auto-Renewal:** 60-day notice window requires immediate calendar tracking.',
    acceptsFiles: true,
    fileHint: 'Upload contract text (.txt)',
  },
  finance: {
    emoji: '💹',
    tagline: 'Financial ratios, KPIs, and report generation.',
    capability: 'Computes margins, EBITDA, burn rate, and financial summaries.',
    inputLabel: 'Enter financial figures',
    exampleInput: 'Q1: Revenue $320k, COGS $190k, OpEx $75k.',
    exampleOutput: '**Financial Summary**\n- Gross Profit: $130,000 (40.6%)\n- Net Margin: 17.2%',
    acceptsFiles: true,
    fileHint: 'Upload financial data (.txt, .csv)',
  },
  transcribe: {
    emoji: '🎙️',
    tagline: 'Convert audio recordings to accurate text transcripts.',
    capability: 'Accepts audio files (MP3, WAV, M4A). Returns timestamped transcripts.',
    inputLabel: 'Upload an audio file',
    exampleInput: '[Audio file: meeting_recording.mp3]',
    exampleOutput: '[00:00] Meeting started. Reviewing MST Blockchain agent settlement architecture.',
    acceptsFiles: true,
    fileHint: 'Upload audio (.mp3, .wav, .m4a)',
  },
  'fact-check': {
    emoji: '✅',
    tagline: 'Cross-reference claims against sources to catch hallucinations.',
    capability: 'Takes a list of claims and returns verification status with reasoning.',
    inputLabel: 'Enter claims to fact-check',
    exampleInput: 'MST Blockchain is an EVM-compatible Layer 1 blockchain.',
    exampleOutput:
      '✅ **VERIFIED:** MST Blockchain is an EVM-compatible Layer 1 blockchain with native currency MSTC.',
    acceptsFiles: true,
    fileHint: 'Upload a .txt file of claims',
  },
};

function bondHealth(agent: Agent): number {
  return agent.bond_amount > 0
    ? Math.max(0, (agent.bond_amount - agent.bond_slashed) / agent.bond_amount)
    : 1;
}

function bondColor(h: number): string {
  if (h > 0.66) return '#22c55e';
  if (h > 0.33) return '#facc15';
  return '#ef4444';
}

function QualityBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: i < Math.round(score * 5) ? 'var(--accent)' : 'var(--border-accent-dim)',
            }}
          />
        ))}
      </div>
      <span className="text-xs font-mono text-[var(--text-3)]">{(score * 100).toFixed(0)}%</span>
    </div>
  );
}

export default function AgentDetailPage() {
  const { id } = useParams() as { id: string };
  const [agent, setAgent] = useState<Agent | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getAgent(id)
      .then(setAgent)
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-4xl mb-3">🤖</p>
        <p className="text-[var(--text-3)]">Agent not found</p>
        <Link href="/marketplace" className="text-[var(--accent)] text-sm mt-4 block">
          ← Back to Marketplace
        </Link>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="w-8 h-8 border-2 border-[var(--border-accent-dim)] border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--text-4)] text-sm font-mono">Loading agent…</p>
      </div>
    );
  }

  const meta = SKILL_META[agent.skill] ?? {
    emoji: '🤖',
    tagline: agent.description,
    capability: agent.description,
    inputLabel: 'Describe what you need',
    exampleInput: 'Your input here',
    exampleOutput: 'Agent output here',
    acceptsFiles: false,
    fileHint: '',
  };

  const health = bondHealth(agent);
  const healthPct = Math.round(health * 100);
  const isActive = agent.status === 'available';
  const priceMstc = (agent.price_mstc ?? agent.price_usdc).toFixed(4);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link
        href="/marketplace"
        className="text-xs font-mono text-[var(--text-4)] hover:text-[var(--accent)] transition-colors mb-6 block"
      >
        ← Marketplace
      </Link>

      {/* Agent identity */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-[var(--border-accent-dim)] bg-[var(--surface)] p-6 mb-6 relative overflow-hidden shadow-sm"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--bg)]">
          <div
            className="w-full transition-all"
            style={{ height: `${healthPct}%`, background: bondColor(health), opacity: 0.8 }}
          />
        </div>

        <div className="pl-3">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{meta.emoji}</span>
                <h1 className="text-xl font-bold text-[var(--text-1)]">{agent.name}</h1>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--tint-accent)] text-[var(--accent)] border border-[var(--border-accent-dim)]">
                  {agent.skill}
                </span>
                <span className="flex items-center gap-1 text-xs font-mono">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isActive ? 'animate-pulse' : ''}`}
                    style={{ background: isActive ? 'var(--accent)' : 'var(--text-5)' }}
                  />
                  <span style={{ color: isActive ? 'var(--accent)' : 'var(--text-5)' }}>
                    {agent.status}
                  </span>
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold font-mono text-[var(--accent)]">{priceMstc} MSTC</div>
              <div className="text-xs text-[var(--text-4)]">per {agent.price_unit}</div>
            </div>
          </div>

          <p className="text-sm text-[var(--text-2)] leading-relaxed mb-4">{meta.tagline}</p>
          <p className="text-xs text-[var(--text-3)] leading-relaxed">{meta.capability}</p>
        </div>
      </motion.div>

      {/* Live stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.07 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
      >
        {[
          { label: 'Jobs Done', value: String(agent.total_jobs) },
          { label: 'Quality', value: null, quality: agent.avg_quality },
          { label: 'Bond Health', value: `${healthPct}%`, color: bondColor(health) },
          {
            label: 'Total Earned',
            value: `${agent.total_earned.toFixed(4)} MSTC`,
            color: agent.total_earned > 0 ? 'var(--accent)' : undefined,
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border-accent-dim)] bg-[var(--surface)] px-4 py-3 shadow-sm"
          >
            <div className="text-[10px] font-mono text-[var(--text-4)] uppercase tracking-wide mb-1">
              {stat.label}
            </div>
            {stat.quality !== undefined ? (
              <QualityBar score={stat.quality} />
            ) : (
              <div
                className="text-sm font-bold font-mono"
                style={{ color: stat.color ?? 'var(--text-2)' }}
              >
                {stat.value}
              </div>
            )}
          </div>
        ))}
      </motion.div>

      {/* Example I/O */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="rounded-xl border border-[var(--border-accent-dim)] bg-[var(--surface)] mb-6 overflow-hidden shadow-sm"
      >
        <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
          <span className="text-xs font-mono text-[var(--text-4)] uppercase tracking-wide">
            Example Input / Output
          </span>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="text-[10px] font-mono text-[var(--text-5)] uppercase tracking-wide mb-1.5">
              Input
            </div>
            <pre className="text-xs text-[var(--text-3)] leading-relaxed whitespace-pre-wrap font-mono bg-[var(--bg)] rounded-lg p-3 border border-[var(--border-accent-dim)]">
              {meta.exampleInput}
            </pre>
          </div>
          <div>
            <div className="text-[10px] font-mono text-[var(--text-5)] uppercase tracking-wide mb-1.5">
              Output
            </div>
            <pre className="text-xs text-[var(--text-2)] leading-relaxed whitespace-pre-wrap font-mono bg-[var(--bg)] rounded-lg p-3 border border-[var(--border-accent-dim)]">
              {meta.exampleOutput}
            </pre>
          </div>
        </div>
      </motion.div>

      {/* Hire CTA */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <Link
          href={`/agents/${id}/hire`}
          className="block w-full py-3.5 text-center rounded-xl font-mono text-sm font-bold bg-[#ef9f27] text-black hover:bg-[#d68f22] transition-colors shadow-md"
        >
          Hire {agent.name} ({priceMstc} MSTC) →
        </Link>
        <p className="text-center text-[10px] font-mono text-[var(--text-5)] mt-2">
          Native MSTC payment · settled on MST Testnet (91562037)
        </p>
      </motion.div>
    </div>
  );
}
