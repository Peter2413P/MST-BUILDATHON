'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { getMetrics, getTransactions } from '@/lib/api';
import type { Metrics, Transaction } from '@/lib/types';
import { useTheme } from '@/lib/theme';
import { getExplorerUrl } from '@/blockchain/mst';

const SKILL_EMOJI: Record<string, string> = {
  summarizer: '📝',
  'code-review': '🔍',
  research: '🔬',
  translate: '🌐',
  sentiment: '💭',
  sql: '🗃️',
  chart: '📊',
  extract: '⛏️',
  'legal-review': '⚖️',
  finance: '💹',
  transcribe: '🎙️',
  'fact-check': '✅',
};

const CHART_COLORS_DARK = [
  '#ef9f27',
  '#f59e0b',
  '#d97706',
  '#b45309',
  '#06b6d4',
  '#8b5cf6',
  '#22c55e',
  '#67e8f9',
];
const CHART_COLORS_LIGHT = [
  '#d97706',
  '#b45309',
  '#92400e',
  '#78350f',
  '#0891b2',
  '#7c3aed',
  '#16a34a',
  '#0e7490',
];

function truncateTx(tx: string) {
  if (!tx) return '';
  return `${tx.slice(0, 10)}…${tx.slice(-6)}`;
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[var(--border-accent-dim)] bg-[var(--surface)] p-5 shadow-sm"
    >
      <div className="text-xs text-[var(--text-4)] uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color: color ?? 'var(--accent)' }}>
        {value}
      </div>
      {sub && <div className="text-xs text-[var(--text-5)] mt-0.5">{sub}</div>}
    </motion.div>
  );
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const CHART_COLORS = isDark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
  const gridStroke = isDark ? '#1e293b' : '#d8d0c8';
  const tickColor = isDark ? '#64748b' : '#52443c';
  const statAmber = isDark ? '#ef9f27' : '#d97706';
  const statGreen = isDark ? '#22c55e' : '#16a34a';

  useEffect(() => {
    getMetrics().then(setMetrics).catch(() => {});
    getTransactions({ limit: 50 }).then(setTxs).catch(() => {});
    const t = setInterval(() => {
      getMetrics().then(setMetrics).catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, []);

  const dailyData = (metrics?.daily_stats ?? []).map(d => ({
    date: d.date.slice(5),
    Jobs: d.jobs,
    MSTC: parseFloat((d.mstc ?? d.usdc)?.toFixed(4) ?? '0'),
  }));

  const pieData = (metrics?.skills_distribution ?? []).map(s => ({
    name: s.skill,
    value: s.count,
  }));

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { value: number; name: string; color: string }[];
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[var(--surface)] border border-[var(--border-accent-dim)] rounded-lg px-3 py-2 text-xs shadow-lg font-mono">
        <div className="text-[var(--text-4)] mb-1">{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' && p.value < 1 ? `${p.value.toFixed(4)} MSTC` : p.value}
          </div>
        ))}
      </div>
    );
  };

  const totalSettled = metrics?.totals.mstc_settled ?? metrics?.totals.usdc_settled ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-1)] mb-1">Analytics Dashboard</h1>
        <p className="text-[var(--text-3)] text-sm font-mono">
          Live agent metrics from MST Blockchain (Testnet 91562037) · refreshes every 10s
        </p>
      </div>

      {/* Totals Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Settled"
          value={`${totalSettled.toFixed(4)} MSTC`}
          sub="On-chain settlement"
          color={statAmber}
        />
        <StatCard
          label="Jobs Completed"
          value={String(metrics?.totals.jobs_completed ?? 0)}
          sub={`of ${metrics?.totals.total_jobs ?? 0} submitted`}
          color={statGreen}
        />
        <StatCard
          label="Avg Settlement"
          value={`${(metrics?.totals.avg_settlement_secs ?? 0).toFixed(1)}s`}
          sub="Nanopayment confirmation"
        />
        <StatCard
          label="Active Agents"
          value={String(metrics?.totals.agents_registered ?? 12)}
          sub="Specialized skills"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Daily Jobs & Settlement */}
        <div className="rounded-xl border border-[var(--border-accent-dim)] bg-[var(--surface)] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--text-1)] mb-4">Daily Activity (Jobs &amp; MSTC)</h3>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="date" stroke={tickColor} fontSize={10} />
                <YAxis stroke={tickColor} fontSize={10} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Jobs" fill="#ef9f27" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-xs font-mono text-[var(--text-5)]">
              No daily stats recorded yet
            </div>
          )}
        </div>

        {/* Skill Distribution */}
        <div className="rounded-xl border border-[var(--border-accent-dim)] bg-[var(--surface)] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--text-1)] mb-4">Skills Utilization</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ''} (${(((percent ?? 0) * 100).toFixed(0))}%)`
                  }
                  fontSize={10}
                >
                  {pieData.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-xs font-mono text-[var(--text-5)]">
              No skill executions recorded yet
            </div>
          )}
        </div>
      </div>

      {/* Transactions Ledger */}
      <div className="rounded-xl border border-[var(--border-accent-dim)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-1)]">Recent On-Chain Settlements</h3>
          <span className="text-[10px] font-mono text-[var(--text-4)]">MST Testnet</span>
        </div>
        {txs.length === 0 ? (
          <p className="text-xs font-mono text-[var(--text-5)] py-4 text-center">
            No transactions recorded yet. Submit a task to execute on-chain settlement.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[var(--text-4)]">
                  <th className="text-left font-mono font-normal px-3 py-2">Job</th>
                  <th className="text-left font-normal px-2 py-2">Agent</th>
                  <th className="text-right font-mono font-normal px-3 py-2">Amount</th>
                  <th className="text-right font-mono font-normal px-3 py-2">Transaction</th>
                </tr>
              </thead>
              <tbody>
                {txs.slice(0, 15).map(tx => (
                  <tr
                    key={tx.id}
                    className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--tint-accent)] transition-colors"
                  >
                    <td className="px-3 py-2 font-mono text-[var(--text-4)]">
                      <Link href={`/jobs/${tx.job_id}`} className="hover:text-[var(--accent)]">
                        {tx.job_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-[var(--text-2)]">
                      <span className="mr-1.5">{SKILL_EMOJI[tx.agent_skill] ?? '🤖'}</span>
                      {tx.agent_name || tx.agent_skill}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--accent)] font-semibold">
                      {(tx.amount_mstc ?? tx.amount_usdc).toFixed(4)} MSTC
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {tx.tx_hash ? (
                        <a
                          href={getExplorerUrl(tx.tx_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-600 dark:text-cyan-400 hover:underline"
                        >
                          {truncateTx(tx.tx_hash)} ↗
                        </a>
                      ) : (
                        <span className="text-[var(--text-5)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
