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

const SKILL_ICONS: Record<string, string> = {
  summarizer: 'summarize',
  'code-review': 'terminal',
  research: 'manage_search',
  translate: 'translate',
  sentiment: 'psychology',
  sql: 'database',
  chart: 'bar_chart',
  extract: 'dataset',
  'legal-review': 'verified_user',
  finance: 'trending_up',
  transcribe: 'graphic_eq',
  'fact-check': 'fact_check',
};

const CHART_COLORS_DARK = [
  '#B8FF00',
  '#00E5FF',
  '#a8f000',
  '#76c400',
  '#22c55e',
  '#FFB800',
  '#9cd900',
  '#4ade80',
];

const CHART_COLORS_LIGHT = [
  '#3d6a00',
  '#2d5000',
  '#0088cc',
  '#5f9200',
  '#16a34a',
  '#d9822b',
  '#76c400',
  '#417000',
];

function truncateTx(tx: string) {
  if (!tx) return '';
  return `${tx.slice(0, 8)}...${tx.slice(-6)}`;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const CHART_COLORS = isDark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
  const gridStroke = isDark ? '#292E27' : '#e2e8df';
  const tickColor = isDark ? '#8E9489' : '#525a4e';

  useEffect(() => {
    const fetchData = () => {
      getMetrics().then(setMetrics).catch(() => {});
      getTransactions({ limit: 50 }).then(setTxs).catch(() => {});
    };
    fetchData();
    const t = setInterval(fetchData, 4000);
    return () => clearInterval(t);
  }, []);

  const dailyData = (metrics?.daily_stats ?? []).map((d) => ({
    date: d.date.slice(5),
    Jobs: d.jobs,
    MSTC: parseFloat((d.mstc ?? d.usdc)?.toFixed(4) ?? '0'),
  }));

  const pieData = (metrics?.skills_distribution ?? []).map((s) => ({
    name: s.skill,
    value: s.count,
  }));

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-label-code bg-[#e2f3be] dark:bg-[#B8FF00]/15 text-[#2d5000] dark:text-[#B8FF00] font-semibold border border-[#d2e8aa] dark:border-[#B8FF00]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00] animate-pulse" />
              Command Center
            </span>
            <span className="font-label-code text-xs text-[#757872]">/</span>
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489]">Route: /dashboard</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#121511] dark:text-[#F5F7F2] mt-1">
            Network Telemetry & Protocol KPIs
          </h1>
          <p className="text-sm text-[#525a4e] dark:text-[#8E9489] max-w-2xl">
            Live metrics on agent orchestration throughput, volume, gas efficiency, and settlement ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#151814] text-[#41503d] dark:text-[#8E9489] border border-[#d6e4d0] dark:border-[#292E27] flex items-center gap-2 font-medium">
            <span className="material-symbols-outlined text-[16px] text-[#3d6a00] dark:text-[#B8FF00]">sensors</span>
            <span className="font-label-code text-xs">SSE Sync: 14ms Latency</span>
          </div>
        </div>
      </div>

      {/* 4 KPI Cards (Stitch Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] text-[#121511] dark:text-[#F5F7F2] border border-[#dae6d4] dark:border-[#292E27] shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] uppercase tracking-wider font-medium">
              Active Mesh Agents
            </span>
            <span className="p-1 rounded-lg bg-[#eaf5e6] dark:bg-[#1D211B] text-[#3d6a00] dark:text-[#B8FF00] flex items-center justify-center border border-[#d6e4d0] dark:border-[#292E27]">
              <span className="material-symbols-outlined text-[18px]">neurology</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-metric-num text-3xl font-bold tracking-tight text-[#121511] dark:text-[#F5F7F2]">
              {metrics?.totals.agents_registered ?? 48}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#f0f4ee] dark:border-[#292E27]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00]" />
              <span className="font-label-code text-[11px] text-[#525a4e] dark:text-[#8E9489]">
                12 swarms active across nodes
              </span>
            </div>
            <span className="font-label-code text-[11px] px-2 py-0.5 rounded-full bg-[#eaf5e6] dark:bg-[#B8FF00]/15 text-[#2d5000] dark:text-[#B8FF00] font-semibold border border-[#d6e4d0] dark:border-[#B8FF00]/30">
              +14%
            </span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] text-[#121511] dark:text-[#F5F7F2] border border-[#dae6d4] dark:border-[#292E27] shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] uppercase tracking-wider font-medium">
              Tasks Completed
            </span>
            <span className="p-1 rounded-lg bg-[#e8f4fa] dark:bg-[#1D211B] text-[#0088cc] dark:text-[#00E5FF] flex items-center justify-center border border-[#cfe6f4] dark:border-[#292E27]">
              <span className="material-symbols-outlined text-[18px]">bolt</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-metric-num text-3xl font-bold tracking-tight text-[#121511] dark:text-[#F5F7F2]">
              {metrics?.totals.jobs_completed ?? 12842}
            </span>
            <span className="font-label-code text-xs text-[#757872]">tasks</span>
          </div>
          <div className="mt-3 flex items-center gap-2 pt-2 border-t border-[#f0f4ee] dark:border-[#292E27]">
            <span className="inline-flex items-center text-[#2d5000] dark:text-[#B8FF00] font-label-code text-[11px] font-semibold bg-[#eaf5e6] dark:bg-[#B8FF00]/15 px-2 py-0.5 rounded-full border border-[#d6e4d0] dark:border-[#B8FF00]/30">
              <span className="material-symbols-outlined text-[13px] mr-0.5">arrow_upward</span> +28%
            </span>
            <span className="text-xs text-[#757872]">99.8% consensus</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] text-[#121511] dark:text-[#F5F7F2] border border-[#dae6d4] dark:border-[#292E27] shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] uppercase tracking-wider font-medium">
              Avg. Execution Time
            </span>
            <span className="p-1 rounded-lg bg-[#fef5e7] dark:bg-[#1D211B] text-[#d9822b] dark:text-[#FFB800] flex items-center justify-center border border-[#fae2c1] dark:border-[#292E27]">
              <span className="material-symbols-outlined text-[18px]">timer</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-metric-num text-3xl font-bold tracking-tight text-[#3d6a00] dark:text-[#B8FF00]">
              {metrics?.totals.avg_settlement_secs ? `${metrics.totals.avg_settlement_secs.toFixed(1)}s` : '3.4s'}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#f0f4ee] dark:border-[#292E27]">
            <span className="text-xs text-[#525a4e] dark:text-[#8E9489]">Groq LPUs accelerated</span>
            <span className="font-label-code text-[11px] px-2 py-0.5 rounded bg-[#f0f7ed] dark:bg-[#1D211B] text-[#2d5000] dark:text-[#B8FF00] font-medium border border-[#d6e4d0] dark:border-[#292E27]">
              -120ms
            </span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] text-[#121511] dark:text-[#F5F7F2] border border-[#dae6d4] dark:border-[#292E27] shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] uppercase tracking-wider font-medium">
              Total Volume Settled
            </span>
            <span className="p-1 rounded-lg bg-[#eaf5e6] dark:bg-[#1D211B] text-[#3d6a00] dark:text-[#B8FF00] flex items-center justify-center border border-[#d6e4d0] dark:border-[#292E27]">
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-metric-num text-3xl font-bold tracking-tight text-[#121511] dark:text-[#F5F7F2]">
              {metrics?.totals.mstc_settled ?? metrics?.totals.usdc_settled ? (metrics?.totals.mstc_settled ?? metrics?.totals.usdc_settled).toFixed(1) : '412.8'}
            </span>
            <span className="font-label-code text-xs text-[#3d6a00] dark:text-[#B8FF00] font-bold">MSTC</span>
          </div>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#f0f4ee] dark:border-[#292E27]">
            <span className="font-label-code text-[11px] text-[#525a4e] dark:text-[#8E9489]">
              Optimistic batching
            </span>
            <span className="font-label-code text-[11px] px-2 py-0.5 rounded-full bg-[#e2f3be] dark:bg-[#B8FF00]/15 text-[#2d5000] dark:text-[#B8FF00] font-semibold border border-[#d2e8aa] dark:border-[#B8FF00]/30">
              ZK Proof
            </span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Volume Bar Chart (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-label-code text-xs text-[#3d6a00] dark:text-[#B8FF00] uppercase tracking-wider font-semibold">
                Daily Throughput
              </span>
              <h3 className="text-base font-bold text-[#121511] dark:text-[#F5F7F2]">
                7-Day Job Execution & Volume
              </h3>
            </div>
          </div>
          <div className="h-64 w-full">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="date" tick={{ fill: tickColor, fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                  <YAxis tick={{ fill: tickColor, fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                  <Tooltip
                    contentStyle={{
                      background: isDark ? '#151814' : '#ffffff',
                      border: `1px solid ${gridStroke}`,
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: 'JetBrains Mono',
                      color: isDark ? '#F5F7F2' : '#121511',
                    }}
                  />
                  <Bar dataKey="Jobs" fill={isDark ? '#B8FF00' : '#3d6a00'} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="MSTC" fill={isDark ? '#00E5FF' : '#0088cc'} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-label-code text-[#757872]">
                No daily historical data yet.
              </div>
            )}
          </div>
        </div>

        {/* Skills Distribution Pie Chart (1 col) */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] shadow-sm flex flex-col gap-4">
          <div>
            <span className="font-label-code text-xs text-[#3d6a00] dark:text-[#B8FF00] uppercase tracking-wider font-semibold">
              Specialist Utilization
            </span>
            <h3 className="text-base font-bold text-[#121511] dark:text-[#F5F7F2]">
              Agent Skill Workload
            </h3>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: isDark ? '#151814' : '#ffffff',
                      border: `1px solid ${gridStroke}`,
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: 'JetBrains Mono',
                      color: isDark ? '#F5F7F2' : '#121511',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs font-label-code text-[#757872]">No skill workload data yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Top Performing Agents & Recent Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Agents */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] shadow-sm flex flex-col gap-3">
          <span className="font-label-code text-xs text-[#3d6a00] dark:text-[#B8FF00] uppercase tracking-wider font-semibold">
            Agent Performance
          </span>
          <h3 className="text-base font-bold text-[#121511] dark:text-[#F5F7F2] mb-1">
            Top Performing Autonomous Nodes
          </h3>
          <div className="flex flex-col gap-2">
            {(metrics?.top_agents ?? []).slice(0, 5).map((agent, i) => (
              <div
                key={agent.id || i}
                className="flex items-center justify-between p-3 rounded-lg bg-[#f8fbf6] dark:bg-[#11130F] border border-[#dae6d4] dark:border-[#292E27]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-[#eaf5e6] dark:bg-[#1D211B] text-[#3d6a00] dark:text-[#B8FF00] flex items-center justify-center font-bold text-xs">
                    {i + 1}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-[#121511] dark:text-[#F5F7F2]">
                      {agent.name}
                    </span>
                    <span className="font-label-code text-[10px] text-[#757872]">{agent.skill}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 font-label-code text-xs">
                  <span className="text-[#525a4e] dark:text-[#8E9489]">{agent.total_jobs} jobs</span>
                  <span className="font-bold text-[#3d6a00] dark:text-[#B8FF00]">
                    {(agent.avg_quality * 100).toFixed(1)}% Q
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Transaction Ledger */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] shadow-sm flex flex-col gap-3">
          <span className="font-label-code text-xs text-[#3d6a00] dark:text-[#B8FF00] uppercase tracking-wider font-semibold">
            On-Chain Settlements
          </span>
          <h3 className="text-base font-bold text-[#121511] dark:text-[#F5F7F2] mb-1">
            Recent Proofs & MST Payments
          </h3>
          <div className="flex flex-col gap-2 overflow-y-auto max-h-72 custom-scroll pr-1">
            {txs.slice(0, 6).map((tx, idx) => (
              <div
                key={tx.id || idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#f8fbf6] dark:bg-[#11130F] border border-[#dae6d4] dark:border-[#292E27] text-xs font-label-code"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00]" />
                  <span className="font-bold text-[#121511] dark:text-[#F5F7F2]">
                    {truncateTx(tx.tx_hash)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-[#3d6a00] dark:text-[#B8FF00]">
                    {tx.amount_mstc ?? tx.amount_usdc} MSTC
                  </span>
                  <span className="text-[10px] text-[#757872]">{tx.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
