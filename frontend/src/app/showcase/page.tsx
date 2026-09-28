'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { getJobs, getMetrics } from '@/lib/api';
import type { Job, Metrics } from '@/lib/types';

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

function elapsed(start: string, end: string | null): string {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const secs = Math.round((e - s) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface ShowcaseJob extends Job {
  agentSkills?: string[];
}

function JobCard({ job, index }: { job: ShowcaseJob; index: number }) {
  const isDirectHire = job.job_type === 'direct';
  const price = job.total_price_mstc ?? job.total_price_usdc;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Link href={`/jobs/${job.id}`}>
        <div className="rounded-xl border border-[var(--border-accent-dim)] bg-[var(--surface)] p-5 hover:border-[var(--border-accent-mid)] hover:bg-[var(--surface-hi)] transition-all cursor-pointer group shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {(job.agentSkills ?? []).slice(0, 4).map((sk, i) => (
                <span key={i} className="text-sm" title={sk}>
                  {SKILL_EMOJI[sk] ?? '🤖'}
                </span>
              ))}
              {(job.agentSkills?.length ?? 0) > 4 && (
                <span className="text-[10px] font-mono text-[var(--text-4)]">
                  +{(job.agentSkills?.length ?? 0) - 4}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isDirectHire && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[var(--border-accent-dim)] text-[var(--accent)]">
                  direct
                </span>
              )}
              {price != null && (
                <span className="text-sm font-bold font-mono text-[var(--accent)]">
                  {price.toFixed(4)} MSTC
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-[var(--text-2)] leading-relaxed mb-3 line-clamp-2 group-hover:text-[var(--text-1)] transition-colors">
            {job.description.length > 140 ? job.description.slice(0, 140) + '…' : job.description}
          </p>

          <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-5)]">
            <span>{job.id.slice(0, 8)}</span>
            <div className="flex items-center gap-3">
              {job.completed_at && job.submitted_at && <span>{elapsed(job.submitted_at, job.completed_at)}</span>}
              <span>{timeAgo(job.submitted_at)}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function ShowcasePage() {
  const [jobs, setJobs] = useState<ShowcaseJob[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [rawJobs, m] = await Promise.all([getJobs(), getMetrics().catch(() => null)]);
        setMetrics(m);
        const enriched: ShowcaseJob[] = rawJobs.map(j => ({
          ...j,
          agentSkills: j.subtasks?.map(s => s.skill) ?? [],
        }));
        setJobs(enriched.filter(j => j.status === 'completed'));
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalSettled = metrics?.totals.mstc_settled ?? metrics?.totals.usdc_settled ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-1)] mb-0.5">Execution Showcase</h1>
          <p className="text-xs font-mono text-[var(--text-4)]">
            Completed multi-agent jobs settled on MST Blockchain
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-lg border border-[var(--border-accent-dim)] bg-[var(--surface)] text-[var(--text-3)]">
            <span className="text-[var(--accent)] font-bold">{metrics?.totals.jobs_completed ?? jobs.length}</span> jobs completed
          </div>
          <div className="px-3 py-1.5 rounded-lg border border-[var(--border-accent-dim)] bg-[var(--surface)] text-[var(--text-3)]">
            <span className="text-[var(--accent)] font-bold">{totalSettled.toFixed(4)}</span> MSTC settled
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-xl bg-[var(--surface)] border border-[var(--border-accent-dim)] animate-pulse shadow-sm"
            />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-accent-dim)] bg-[var(--surface)] p-12 text-center">
          <p className="text-3xl mb-3">⚡</p>
          <p className="text-sm font-semibold text-[var(--text-2)] mb-1">No completed jobs yet</p>
          <p className="text-xs text-[var(--text-4)] font-mono mb-4">
            Submit your first task to see autonomous agent execution settled on MST Blockchain.
          </p>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-[#ef9f27] text-black font-bold text-xs font-mono hover:bg-[#d68f22] transition-colors inline-block"
          >
            Submit a Job →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job, i) => (
            <JobCard key={job.id} job={job} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
