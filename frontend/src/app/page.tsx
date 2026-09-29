'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getJobs, submitJob, sendChatMessage } from '@/lib/api';
import type { Job } from '@/lib/types';
import { useWallet } from '@/lib/wallet';
import { estimateJobCost } from '@/blockchain/mst';
import ChatWorkspace from '@/components/ChatWorkspace';

function timeAgo(isoString: string): string {
  const diffSecs = Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  return `${Math.floor(diffSecs / 3600)}h ago`;
}

export default function Home() {
  const router = useRouter();
  const { address, sendPayment } = useWallet();

  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<'All' | 'Running' | 'Settled' | 'Pending'>('All');
  const [viewMode, setViewMode] = useState<'launcher' | 'chat'>('launcher');

  useEffect(() => {
    getJobs()
      .then(setJobs)
      .catch(() => setJobs([]));
    const timer = setInterval(() => {
      getJobs().then(setJobs).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleLaunch = async (textToRun?: string) => {
    const text = (textToRun || prompt).trim();
    if (!text || submitting) return;

    setSubmitting(true);
    try {
      // Pass message through Conversation Intelligence Router
      const chatRes = await sendChatMessage({
        message: text,
        walletAddress: address || undefined,
      });

      if (chatRes.intent === 'task' && chatRes.jobId) {
        if (address && sendPayment) {
          try {
            const cost = estimateJobCost(text);
            const txHash = await sendPayment(cost, text);
            if (txHash && txHash.startsWith('0x')) {
              await fetch(`/api/jobs/${chatRes.jobId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyer_tx: txHash }),
              }).catch(() => {});
            }
          } catch (payErr) {
            console.warn('[MST Testnet] Payment rejected/deferred:', payErr);
          }
        }
        router.push(`/jobs/${chatRes.jobId}`);
      } else {
        setViewMode('chat');
      }
    } catch (err) {
      console.error('Failed to submit prompt:', err);
      setViewMode('chat');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusCategory = (status: string) => {
    if (status === 'running' || status === 'planning') return 'Running';
    if (status === 'completed' || status === 'settled') return 'Settled';
    if (status === 'pending') return 'Pending';
    return 'All';
  };

  const filteredJobs =
    activeTab === 'All'
      ? jobs
      : jobs.filter((j) => getStatusCategory(j.status) === activeTab);

  if (viewMode === 'chat') {
    return <ChatWorkspace />;
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
      {/* ── Header Telemetry & Title ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-label-code text-xs text-[#3d6a00] dark:text-[#B8FF00] uppercase tracking-wider flex items-center gap-1.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00] animate-ping" />
              Telemetry Console
            </span>
            <span className="font-label-code text-xs text-[#757872]">/</span>
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489]">
              Route: /orchestrator
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl tracking-tight text-[#121511] dark:text-[#F5F7F2] font-bold mt-1">
            Turn One Prompt Into a Team of AI Agents
          </h1>
          <p className="text-sm text-[#525a4e] dark:text-[#8E9489] max-w-2xl">
            Deconstruct high-level goals into parallel autonomous workflows verified on-chain. Sub-agents coordinate tasks, audit code, and settle compute proofs in seconds.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#151814] text-[#41503d] dark:text-[#8E9489] border border-[#d6e4d0] dark:border-[#292E27] flex items-center gap-2 font-medium">
            <span className="material-symbols-outlined text-[16px] w-4 h-4 flex items-center justify-center text-[#3d6a00] dark:text-[#B8FF00]">
              sensors
            </span>
            <span className="font-label-code text-xs">SSE Live: 14ms Latency</span>
          </div>
          <button
            onClick={() => setViewMode('chat')}
            className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-[#151814] hover:bg-[#eaf5e6] dark:hover:bg-[#1D211B] text-[#121511] dark:text-[#F5F7F2] text-xs flex items-center gap-1.5 transition-colors border border-[#dae6d4] dark:border-[#292E27] shadow-sm font-semibold"
          >
            <span className="material-symbols-outlined text-[16px] w-4 h-4 flex items-center justify-center">
              chat
            </span>
            <span>Open Chat Console</span>
          </button>
        </div>
      </div>

      {/* ── Main Prompt Card (Stitch Exact Box) ──────────────────────────── */}
      <div className="bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] rounded-xl p-4 shadow-sm flex flex-col gap-3">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleLaunch();
              }
            }}
            placeholder="Describe your goal or protocol requirement in detail (e.g., 'Deploy an automated arbitrage watcher on Arbitrum with dual consensus verification and alert telemetry')..."
            rows={3}
            className="w-full rounded-lg border border-[#dbe3d8] dark:border-[#292E27] bg-[#fbfdfa] dark:bg-[#11130F] text-[#121511] dark:text-[#F5F7F2] p-3 text-sm font-normal placeholder-[#757872] focus:bg-white dark:focus:bg-[#151814] focus:border-[#3d6a00] dark:focus:border-[#B8FF00] focus:ring-1 focus:ring-[#3d6a00] dark:focus:ring-[#B8FF00] transition-all resize-none outline-none leading-relaxed"
          />
        </div>

        <div className="flex flex-col gap-2.5 pt-0.5">
          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[#757872] font-medium mr-1">Presets:</span>
            <button
              onClick={() => {
                const text = 'Analyze dataset for multi-sig anomaly vectors across validator logs';
                setPrompt(text);
              }}
              className="text-xs font-medium text-[#2d5000] dark:text-[#B8FF00] bg-[#eaf5e6] dark:bg-[#1D211B] hover:bg-[#dfedd8] dark:hover:bg-[#292E27] border border-[#d8e8d3] dark:border-[#292E27] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[15px] w-4 h-4 flex items-center justify-center">
                query_stats
              </span>
              <span>Analyze dataset</span>
            </button>
            <button
              onClick={() => {
                const text = 'Research market volatility and generate optimal hedge routing parameters';
                setPrompt(text);
              }}
              className="text-xs font-medium text-[#2d5000] dark:text-[#B8FF00] bg-[#eaf5e6] dark:bg-[#1D211B] hover:bg-[#dfedd8] dark:hover:bg-[#292E27] border border-[#d8e8d3] dark:border-[#292E27] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[15px] w-4 h-4 flex items-center justify-center">
                trending_up
              </span>
              <span>Research market</span>
            </button>
            <button
              onClick={() => {
                const text = 'Audit smart contract execution trace for reentrancy vulnerabilities and gas spikes';
                setPrompt(text);
              }}
              className="text-xs font-medium text-[#2d5000] dark:text-[#B8FF00] bg-[#eaf5e6] dark:bg-[#1D211B] hover:bg-[#dfedd8] dark:hover:bg-[#292E27] border border-[#d8e8d3] dark:border-[#292E27] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[15px] w-4 h-4 flex items-center justify-center">
                verified_user
              </span>
              <span>Audit contract</span>
            </button>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#f0f4ee] dark:border-[#292E27]">
            <div className="flex items-center gap-1.5 bg-[#eef8eb] dark:bg-[#1D211B] text-[#2d5000] dark:text-[#B8FF00] border border-[#d2e8cb] dark:border-[#292E27] px-2.5 py-1 rounded-lg text-xs font-semibold">
              <span className="material-symbols-outlined text-[15px] w-4 h-4 flex items-center justify-center text-[#3d6a00] dark:text-[#B8FF00]">
                token
              </span>
              <span>~8.40 MSTC · 3 Agents</span>
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <Link
                href="/marketplace"
                className="bg-white dark:bg-[#1D211B] text-[#141613] dark:text-[#F5F7F2] hover:bg-[#f4f7f2] dark:hover:bg-[#292E27] border border-[#daddd9] dark:border-[#292E27] font-medium text-xs md:text-sm px-3.5 py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1.5"
              >
                <span>Explore Agents</span>
              </Link>
              <button
                onClick={() => handleLaunch()}
                disabled={!prompt.trim() || submitting}
                className="bg-[#a8f000] dark:bg-[#B8FF00] hover:bg-[#9de000] active:scale-[0.98] text-[#000000] font-bold text-xs md:text-sm px-4 py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] w-4 h-4 flex items-center justify-center animate-spin">
                      autorenew
                    </span>
                    <span>Orchestrating Swarm...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px] w-4 h-4 flex items-center justify-center">
                      bolt
                    </span>
                    <span>Run with AgentMesh</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 KPI Telemetry Cards (Stitch Design) ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] text-[#121511] dark:text-[#F5F7F2] border border-[#dae6d4] dark:border-[#292E27] shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] uppercase tracking-wider font-medium">
              Active Mesh Agents
            </span>
            <span className="w-8 h-8 rounded-lg bg-[#eaf5e6] dark:bg-[#1D211B] text-[#3d6a00] dark:text-[#B8FF00] flex items-center justify-center border border-[#d6e4d0] dark:border-[#292E27] shrink-0">
              <span className="material-symbols-outlined text-[18px] w-4 h-4 flex items-center justify-center">
                neurology
              </span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-metric-num text-3xl font-bold tracking-tight text-[#121511] dark:text-[#F5F7F2]">
              48
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

        {/* Card 2 */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] text-[#121511] dark:text-[#F5F7F2] border border-[#dae6d4] dark:border-[#292E27] shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] uppercase tracking-wider font-medium">
              Tasks Completed
            </span>
            <span className="w-8 h-8 rounded-lg bg-[#e8f4fa] dark:bg-[#1D211B] text-[#0088cc] dark:text-[#00E5FF] flex items-center justify-center border border-[#cfe6f4] dark:border-[#292E27] shrink-0">
              <span className="material-symbols-outlined text-[18px] w-4 h-4 flex items-center justify-center">
                bolt
              </span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-metric-num text-3xl font-bold tracking-tight text-[#121511] dark:text-[#F5F7F2]">
              12,842
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

        {/* Card 3 */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] text-[#121511] dark:text-[#F5F7F2] border border-[#dae6d4] dark:border-[#292E27] shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] uppercase tracking-wider font-medium">
              Avg. Execution Time
            </span>
            <span className="w-8 h-8 rounded-lg bg-[#fef5e7] dark:bg-[#1D211B] text-[#d9822b] dark:text-[#FFB800] flex items-center justify-center border border-[#fae2c1] dark:border-[#292E27] shrink-0">
              <span className="material-symbols-outlined text-[18px] w-4 h-4 flex items-center justify-center">
                timer
              </span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-metric-num text-3xl font-bold tracking-tight text-[#3d6a00] dark:text-[#B8FF00]">
              3.4s
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#f0f4ee] dark:border-[#292E27]">
            <span className="text-xs text-[#525a4e] dark:text-[#8E9489]">Groq LPUs accelerated</span>
            <span className="font-label-code text-[11px] px-2 py-0.5 rounded bg-[#f0f7ed] dark:bg-[#1D211B] text-[#2d5000] dark:text-[#B8FF00] font-medium border border-[#d6e4d0] dark:border-[#292E27]">
              -120ms
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] text-[#121511] dark:text-[#F5F7F2] border border-[#dae6d4] dark:border-[#292E27] shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] uppercase tracking-wider font-medium">
              Total Gas Saved
            </span>
            <span className="w-8 h-8 rounded-lg bg-[#eaf5e6] dark:bg-[#1D211B] text-[#3d6a00] dark:text-[#B8FF00] flex items-center justify-center border border-[#d6e4d0] dark:border-[#292E27] shrink-0">
              <span className="material-symbols-outlined text-[18px] w-4 h-4 flex items-center justify-center">
                account_balance
              </span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-metric-num text-3xl font-bold tracking-tight text-[#121511] dark:text-[#F5F7F2]">
              412.8
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

      {/* ── Recent Pipeline Executions Table ─────────────────────────────── */}
      <div className="bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] rounded-xl p-5 shadow-sm flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edeeec] dark:border-[#292E27] pb-4">
          <div>
            <span className="font-label-code text-xs text-[#3d6a00] dark:text-[#B8FF00] uppercase tracking-wider font-semibold">
              Telemetry Log
            </span>
            <h3 className="text-lg font-bold text-[#121511] dark:text-[#F5F7F2] tracking-tight">
              Recent Pipeline Executions
            </h3>
            <p className="text-xs text-[#525a4e] dark:text-[#8E9489]">
              Live telemetry of autonomous agent multi-step workflows
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#f0f7ed] dark:bg-[#1D211B] p-1 rounded-lg border border-[#d6e4d0] dark:border-[#292E27]">
            {(['All', 'Running', 'Settled', 'Pending'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  activeTab === tab
                    ? 'bg-white dark:bg-[#151814] text-[#121511] dark:text-[#B8FF00] shadow-sm'
                    : 'text-[#525a4e] dark:text-[#8E9489] hover:text-[#121511] dark:hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto custom-scroll">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-[#edeeec] dark:border-[#292E27] text-[11px] font-semibold uppercase tracking-wider text-[#757872] font-label-code">
                <th className="py-3 px-4">Pipeline / Task ID</th>
                <th className="py-3 px-4">Orchestrated Swarm</th>
                <th className="py-3 px-4">Status & Progress</th>
                <th className="py-3 px-4">Gas / Fee</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f3ee] dark:divide-[#292E27] text-xs">
              {filteredJobs.slice(0, 8).map((job) => {
                const isRunning = job.status === 'running' || job.status === 'planning';
                const isSettled = job.status === 'completed' || job.status === 'settled';
                const price = job.total_price_mstc ?? job.total_price_usdc;

                const subtasks = job.subtasks || [];
                const completedCount = subtasks.filter(
                  (s) => s.status === 'completed' || s.status === 'settled'
                ).length;
                const pct = isSettled
                  ? 100
                  : subtasks.length > 0
                  ? Math.round((completedCount / subtasks.length) * 100) || (isRunning ? 50 : 10)
                  : isRunning
                  ? 50
                  : 0;

                return (
                  <tr
                    key={job.id}
                    onClick={() => router.push(`/jobs/${job.id}`)}
                    className="hover:bg-[#fbfdfa] dark:hover:bg-[#1D211B] transition-colors group cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-[#141613] dark:text-[#F5F7F2] group-hover:text-[#3d6a00] dark:group-hover:text-[#B8FF00] transition-colors line-clamp-1">
                          {job.description}
                        </span>
                        <span className="font-label-code text-[11px] text-[#757872]">
                          ID #{job.id.slice(0, 10)}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {(job.subtasks && job.subtasks.length > 0
                            ? job.subtasks.slice(0, 3)
                            : [{ skill: 'Planner' }, { skill: 'Agent' }]
                          ).map((st, i) => (
                            <span
                              key={i}
                              className="inline-flex size-6 rounded-full bg-[#dcf2cb] dark:bg-[#B8FF00]/20 text-[#2d5000] dark:text-[#B8FF00] border-2 border-white dark:border-[#151814] items-center justify-center font-bold text-[10px] uppercase"
                            >
                              {st.skill ? st.skill[0] : 'A'}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-[#525a4e] dark:text-[#8E9489] font-medium">
                          {job.subtasks?.length ? `${job.subtasks.length} Agents` : '3 Agents'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1.5 w-44">
                        <div className="flex items-center justify-between">
                          {isRunning ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#2d5000] dark:text-[#B8FF00] bg-[#eaf5e6] dark:bg-[#B8FF00]/15 px-2 py-0.5 rounded-full border border-[#d2e8cb] dark:border-[#B8FF00]/30">
                              <span className="size-1.5 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00] animate-ping" />
                              Running
                            </span>
                          ) : isSettled ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#141613] dark:text-[#F5F7F2] bg-[#edeeec] dark:bg-[#1D211B] px-2 py-0.5 rounded-full border border-[#daddd9] dark:border-[#292E27]">
                              <span className="material-symbols-outlined text-[13px] w-3.5 h-3.5 flex items-center justify-center text-[#3d6a00] dark:text-[#B8FF00]">
                                check_circle
                              </span>
                              Settled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#ba1a1a] bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full">
                              Pending
                            </span>
                          )}
                          <span className="text-[11px] font-medium text-[#525a4e] dark:text-[#8E9489]">
                            {pct}%
                          </span>
                        </div>
                        <div className="w-full bg-[#e8eee6] dark:bg-[#1D211B] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-[#3d6a00] dark:bg-[#B8FF00] h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-metric-num text-xs font-bold text-[#141613] dark:text-[#F5F7F2]">
                      {price ?? '6.42'} MSTC
                    </td>

                    <td className="py-3 px-4 text-[#757872] dark:text-[#8E9489] font-label-code text-[11px]">
                      {job.submitted_at || job.created_at ? timeAgo(job.submitted_at || job.created_at!) : '12s ago'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#2d5000] dark:text-[#B8FF00] hover:text-[#0f2000] bg-[#eef8eb] dark:bg-[#1D211B] hover:bg-[#e2f3be] dark:hover:bg-[#B8FF00]/20 border border-[#d6e8d0] dark:border-[#292E27] px-3 py-1 rounded-lg transition-colors"
                      >
                        <span>Pipeline</span>
                        <span className="material-symbols-outlined text-[14px] w-3.5 h-3.5 flex items-center justify-center">
                          arrow_forward
                        </span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
