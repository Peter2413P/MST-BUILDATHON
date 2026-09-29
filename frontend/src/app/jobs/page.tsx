'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getJobs } from '@/lib/api';
import type { Job } from '@/lib/types';

function elapsed(start: string, end: string | null): string {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  const secs = Math.max(1, Math.round(ms / 1000));
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function timeAgo(isoString: string): string {
  const diffSecs = Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  return `${Math.floor(diffSecs / 3600)}h ago`;
}

const FILTERS = ['All', 'Running', 'Settled', 'Pending', 'Failed'] as const;

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');

  useEffect(() => {
    getJobs()
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
    const t = setInterval(() => getJobs().then(setJobs).catch(() => {}), 4000);
    return () => clearInterval(t);
  }, []);

  const getStatusCategory = (status: string) => {
    if (status === 'running' || status === 'planning') return 'Running';
    if (status === 'completed' || status === 'settled') return 'Settled';
    if (status === 'pending') return 'Pending';
    if (status === 'failed' || status === 'cancelled') return 'Failed';
    return 'All';
  };

  const count = (f: string) =>
    f === 'All' ? jobs.length : jobs.filter((j) => getStatusCategory(j.status) === f).length;

  const filtered =
    filter === 'All'
      ? jobs
      : jobs.filter((j) => getStatusCategory(j.status) === filter);

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-label-code bg-[#e2f3be] dark:bg-[#B8FF00]/15 text-[#2d5000] dark:text-[#B8FF00] font-semibold border border-[#d2e8aa] dark:border-[#B8FF00]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00] animate-pulse" />
              Live Telemetry
            </span>
            <span className="font-label-code text-xs text-[#757872]">/</span>
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489]">Route: /jobs</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#121511] dark:text-[#F5F7F2] mt-1">
            Pipeline Execution Ledger
          </h1>
          <p className="text-sm text-[#525a4e] dark:text-[#8E9489] max-w-2xl">
            {jobs.length} autonomous workflows recorded · real-time DAG steps & micropayments verified on MST Blockchain.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-[#a8f000] dark:bg-[#B8FF00] hover:bg-[#9de000] text-black font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            <span>Launch Pipeline</span>
          </Link>
        </div>
      </div>

      {/* Main Ledger Card */}
      <div className="bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] rounded-xl p-5 shadow-sm flex flex-col gap-4">
        {/* Toolbar Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edeeec] dark:border-[#292E27] pb-4">
          <div>
            <span className="font-label-code text-xs text-[#3d6a00] dark:text-[#B8FF00] uppercase tracking-wider font-semibold">
              Telemetry Log
            </span>
            <h3 className="text-lg font-bold text-[#121511] dark:text-[#F5F7F2] tracking-tight">
              Recent Workflows & Swarms
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-[#f0f7ed] dark:bg-[#1D211B] p-1 rounded-lg border border-[#d6e4d0] dark:border-[#292E27]">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  filter === f
                    ? 'bg-white dark:bg-[#151814] text-[#121511] dark:text-[#B8FF00] shadow-sm'
                    : 'text-[#525a4e] dark:text-[#8E9489] hover:text-[#121511] dark:hover:text-white'
                }`}
              >
                {f} ({count(f)})
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-16 text-center text-xs font-label-code text-[#757872]">
            Loading execution ledger...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs font-label-code text-[#757872] flex flex-col items-center gap-2">
            <span>No {filter !== 'All' ? filter.toLowerCase() : ''} jobs found.</span>
            <Link
              href="/"
              className="text-[#3d6a00] dark:text-[#B8FF00] font-semibold hover:underline"
            >
              Submit a prompt to start one →
            </Link>
          </div>
        ) : (
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
                {filtered.map((job) => {
                  const isRunning = job.status === 'running' || job.status === 'planning';
                  const isSettled = job.status === 'completed' || job.status === 'settled';
                  const isFailed = job.status === 'failed' || job.status === 'cancelled';
                  const price = job.total_price_mstc ?? job.total_price_usdc;

                  // Compute subtask progress %
                  const subtasks = job.subtasks || [];
                  const completedSubtasks = subtasks.filter(
                    (s) => s.status === 'completed' || s.status === 'settled'
                  ).length;
                  const progressPct = isSettled
                    ? 100
                    : subtasks.length > 0
                    ? Math.round((completedSubtasks / subtasks.length) * 100) || (isRunning ? 45 : 10)
                    : isRunning
                    ? 50
                    : 0;

                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-[#fbfdfa] dark:hover:bg-[#1D211B] transition-colors group cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <Link href={`/jobs/${job.id}`} className="flex flex-col">
                          <span className="font-semibold text-sm text-[#141613] dark:text-[#F5F7F2] group-hover:text-[#3d6a00] dark:group-hover:text-[#B8FF00] transition-colors line-clamp-1">
                            {job.description}
                          </span>
                          <span className="font-label-code text-[11px] text-[#757872]">
                            ID #{job.id.slice(0, 10)}
                          </span>
                        </Link>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {(job.subtasks && job.subtasks.length > 0
                              ? job.subtasks.slice(0, 4)
                              : [{ skill: 'Planner' }, { skill: 'Executor' }]
                            ).map((st, sIdx) => (
                              <span
                                key={sIdx}
                                className="inline-flex size-6 rounded-full bg-[#dcf2cb] dark:bg-[#B8FF00]/20 text-[#2d5000] dark:text-[#B8FF00] border-2 border-white dark:border-[#151814] items-center justify-center font-bold text-[10px] uppercase"
                                title={st.skill}
                              >
                                {st.skill ? st.skill[0] : 'A'}
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-[#525a4e] dark:text-[#8E9489] font-medium">
                            {job.subtasks && job.subtasks.length > 0
                              ? `${job.subtasks.length} Agents`
                              : 'Swarm'}
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
                                <span className="material-symbols-outlined text-[11px] text-[#3d6a00] dark:text-[#B8FF00]">
                                  check_circle
                                </span>
                                Settled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#ba1a1a] bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/50">
                                {isFailed ? 'Failed' : 'Pending'}
                              </span>
                            )}
                            <span className="text-[11px] font-medium text-[#525a4e] dark:text-[#8E9489]">
                              {progressPct}%
                            </span>
                          </div>
                          <div className="w-full bg-[#e8eee6] dark:bg-[#1D211B] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isFailed ? 'bg-red-500' : 'bg-[#3d6a00] dark:bg-[#B8FF00]'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-metric-num text-xs font-bold text-[#141613] dark:text-[#F5F7F2]">
                        {price ?? 0} MSTC
                      </td>

                      <td className="py-3 px-4 text-[#757872] dark:text-[#8E9489] font-label-code text-[11px]">
                        {job.submitted_at || job.created_at ? timeAgo(job.submitted_at || job.created_at!) : 'Just now'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {job.buyer_tx && (
                            <a
                              href={`https://testnet.mstscan.com/tx/${job.buyer_tx}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View on MSTScan Testnet Explorer"
                              className="p-1 rounded-lg text-[#3d6a00] dark:text-[#B8FF00] hover:bg-[#eaf5e6] dark:hover:bg-[#1D211B] border border-[#d6e8d0] dark:border-[#292E27] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                            </a>
                          )}
                          <Link
                            href={`/jobs/${job.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2d5000] dark:text-[#B8FF00] hover:text-[#0f2000] bg-[#eef8eb] dark:bg-[#1D211B] hover:bg-[#e2f3be] dark:hover:bg-[#B8FF00]/20 border border-[#d6e8d0] dark:border-[#292E27] px-3 py-1 rounded-lg transition-colors"
                          >
                            <span>Pipeline</span>
                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
