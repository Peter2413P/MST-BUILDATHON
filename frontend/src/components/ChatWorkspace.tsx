'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { getJob, getJobs, submitJob } from '@/lib/api';
import type { Job, Subtask } from '@/lib/types';
import ArtifactRenderer from './artifacts/ArtifactRenderer';
import { useWallet } from '@/lib/wallet';
import { estimateJobCost, getExplorerUrl } from '@/blockchain/mst';

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

interface MessageTurn {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  startedAt?: number;
  completedAt?: number;
  durationSecs?: number;
  jobId?: string;
  status?: 'pending' | 'planning' | 'running' | 'settling' | 'completed' | 'failed';
  subtasks?: Subtask[];
  result?: string | null;
  error?: string | null;
  buyerTx?: string | null;
  reasonedOpen?: boolean;
  toolsOpen?: boolean;
}

const DEFAULT_CHIPS = [
  { label: 'Looks great! 💪', icon: 'sparkles' },
  { label: 'Change pricing to 3 tiers', icon: 'currency' },
  { label: 'Swap heart monitor for workout demo', icon: 'heart' },
  { label: 'Review code & optimize performance', icon: 'code' },
  { label: 'Fact-check claims & statistics', icon: 'check' },
  { label: 'Translate summary to Spanish', icon: 'globe' },
  { label: 'Generate SQL query & chart spec', icon: 'sql' },
];

const TERMINAL_STATES = new Set([
  'completed',
  'failed',
  'cancelled',
  'rejected',
  'expired',
  'settled',
  'payment_failed',
]);
const DONE_STATUSES = TERMINAL_STATES;

function formatTime(isoString?: string | null) {
  if (!isoString) {
    const now = new Date();
    return (
      now.toLocaleDateString('en-US', { day: 'numeric', month: 'long' }) +
      ', ' +
      now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    );
  }
  const d = new Date(isoString);
  return (
    d.toLocaleDateString('en-US', { day: 'numeric', month: 'long' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );
}

function truncateStr(str: string, maxLen = 34) {
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

function truncateTx(tx?: string | null) {
  return tx ? `${tx.slice(0, 8)}…${tx.slice(-6)}` : '';
}

function generateDecompositionThoughts(query: string, subtasks: Subtask[]) {
  const thoughts = [];
  thoughts.push(`Understanding intent: "${query}"`);

  if (subtasks.length > 0) {
    thoughts.push(`Autonomous Planner decomposed task into ${subtasks.length} specialized agent subtasks:`);
    subtasks.forEach((st, idx) => {
      thoughts.push(
        `• Step ${idx + 1} (${st.skill}): Routed to ${st.agent_name || st.skill + ' specialist'} (complexity weight ×${
          st.complexity_weight || 1
        })`
      );
    });
    thoughts.push(`Context pipeline: Output from each subtask is automatically piped forward as context for subsequent agents.`);
    thoughts.push(`Settlement strategy: Dynamic micropayment splitting dynamically calculated and settled on MST Blockchain.`);
  } else {
    thoughts.push('Analyzing query intent and querying agent registry for best matching capabilities...');
    thoughts.push('Matching skill dependencies: Decomposition & synthesis pipeline.');
    thoughts.push('Preparing context routing and estimating on-chain settlement allocation.');
  }

  return thoughts;
}

// ── Antigravity-Style Live Elapsed Timer Component ─────────────────────────────
function ThinkingTimer({
  isRunning,
  startedAt,
  durationSecs,
}: {
  isRunning: boolean;
  startedAt?: number;
  durationSecs?: number;
}) {
  const [elapsed, setElapsed] = useState<number>(durationSecs ?? 0);

  useEffect(() => {
    if (!isRunning || !startedAt) {
      if (durationSecs != null) setElapsed(durationSecs);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      setElapsed(parseFloat(((now - startedAt) / 1000).toFixed(1)));
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, startedAt, durationSecs]);

  if (isRunning) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span>Thinking ({elapsed.toFixed(1)}s)...</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400 bg-zinc-800/60 border border-zinc-700/50 px-2 py-0.5 rounded-full">
      <span>Thought for {elapsed > 0 ? elapsed.toFixed(1) : '2.8'}s</span>
    </span>
  );
}

interface ChatWorkspaceProps {
  initialJobId?: string;
}

export default function ChatWorkspace({ initialJobId }: ChatWorkspaceProps) {
  const router = useRouter();
  const { address, balance, connect, sendPayment } = useWallet();

  const [currentJobId, setCurrentJobId] = useState<string | undefined>(initialJobId);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [messages, setMessages] = useState<MessageTurn[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [webSearchActive, setWebSearchActive] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [selectedSubtaskIndex, setSelectedSubtaskIndex] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePollingJobIdRef = useRef<string | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chipsScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch recent jobs list for sidebar
  const fetchRecentJobs = useCallback(async () => {
    try {
      const list = await getJobs();
      setRecentJobs(list || []);
    } catch {
      // ignore
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchRecentJobs();
  }, [fetchRecentJobs]);

  useEffect(() => {
    if (initialJobId) {
      setCurrentJobId(initialJobId);
    }
  }, [initialJobId]);

  // Polling lifecycle for active job
  useEffect(() => {
    if (!currentJobId || currentJobId.startsWith('temp-')) {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      activePollingJobIdRef.current = null;

      if (!currentJobId) {
        // Default welcome state matching Stitch mockup if no job loaded
        setMessages([
          {
            id: 'welcome-user',
            sender: 'user',
            content: 'Create a landing page for an AI-powered fitness app with a pricing section and contact form.',
            timestamp: '2026-09-28T19:40:00Z',
          },
          {
            id: 'welcome-assistant',
            sender: 'assistant',
            content: '',
            timestamp: '2026-09-28T19:40:05Z',
            startedAt: Date.now() - 3200,
            completedAt: Date.now(),
            durationSecs: 3.2,
            status: 'completed',
            subtasks: [
              {
                id: 'st-1',
                job_id: 'default',
                agent_id: 'agent-artifact-design',
                agent_name: 'Artifact Design Skill',
                skill: 'research',
                prompt: 'Design landing page architecture for AI fitness app',
                result: 'Generated modern dark hydro layout with interactive rep counter.',
                tokens_used: 340,
                complexity_weight: 1.5,
                quality_score: 0.98,
                contribution_pct: 0.5,
                payment_mstc: 0.005,
                payment_usdc: 0.005,
                payment_tx: null,
                status: 'completed',
                position: 1,
                started_at: null,
                completed_at: null,
              },
              {
                id: 'st-2',
                job_id: 'default',
                agent_id: 'agent-code-review',
                agent_name: 'Artifact Create',
                skill: 'code-review',
                prompt: 'Synthesize complete landing page HTML & Tailwind specs',
                result: 'Created validated HTML visualization artifact.',
                tokens_used: 480,
                complexity_weight: 2.0,
                quality_score: 1.0,
                contribution_pct: 0.5,
                payment_mstc: 0.005,
                payment_usdc: 0.005,
                payment_tx: null,
                status: 'completed',
                position: 2,
                started_at: null,
                completed_at: null,
              },
            ],
            result: `BOOM! 💪 The **RepIQ Fitness Landing Page** is up and flexing — check the card below!

Here's what this beautiful beast includes:

- **Hero** — "Your form coach that never *blinks*" with a **live heart-rate monitor** that actually pulses and updates its BPM. It's the only landing page element that's technically doing cardio! 🫀
- **Features** — real-time form feedback, adaptive programming, and recovery intelligence
- **Pricing** — three tiers (Warm-up free / Personal best $12 / Elite squad $29) with a "Most popular" spotlight
- **Contact form** — name, email, and a "what are you training for?" field with validation that politely roasts you for forgetting your email

Design-wise it's a deep-petrol-and-aqua "pool" palette with poster-style Anton type and smooth scroll reveals.

Want me to tweak the branding, pricing numbers, or swap that heart monitor for a fake workout demo screen? Just say the word!`,
            reasonedOpen: false,
            toolsOpen: false,
          },
        ]);
      }
      return;
    }

    const targetJobId = currentJobId;

    // Protection against duplicate polling loops for the same job
    if (activePollingJobIdRef.current === targetJobId && pollingTimerRef.current) {
      return;
    }

    // Cancel previous polling timer & in-flight request
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    activePollingJobIdRef.current = targetJobId;
    let isCancelled = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    console.log(`[Job Poller] started: ${targetJobId}`);

    const stopPolling = (reason = 'terminal state') => {
      isCancelled = true;
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      activePollingJobIdRef.current = null;
      console.log(`[Job Poller] stopped: ${reason}`);
    };

    async function poll() {
      if (isCancelled) return;

      try {
        const response = await fetch(`/api/jobs/${targetJobId}`, {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          if (!isCancelled) {
            pollingTimerRef.current = setTimeout(poll, 2000);
          }
          return;
        }

        const jobData: Job = await response.json();
        if (isCancelled) return;

        console.log(`[Job Poller] status: ${jobData.status}`);
        const isTerminal = TERMINAL_STATES.has(jobData.status);
        const subtasks = jobData.subtasks || [];

        setMessages(prev => {
          const existingIdx = prev.findIndex(m => m.jobId === targetJobId && m.sender === 'assistant');
          if (existingIdx !== -1) {
            const updated = [...prev];
            const curr = updated[existingIdx];
            const wasRunning = curr.status && !TERMINAL_STATES.has(curr.status);

            const startTime = curr.startedAt || (jobData.submitted_at ? new Date(jobData.submitted_at).getTime() : Date.now());
            const endTime = jobData.completed_at ? new Date(jobData.completed_at).getTime() : Date.now();
            const durationSecs = parseFloat(((endTime - startTime) / 1000).toFixed(1));

            updated[existingIdx] = {
              ...curr,
              status: jobData.status,
              subtasks,
              result: jobData.result,
              error: jobData.error,
              buyerTx: jobData.buyer_tx || jobData.transaction_hash,
              startedAt: startTime,
              completedAt: endTime,
              durationSecs: durationSecs > 0 ? durationSecs : curr.durationSecs,
              reasonedOpen: wasRunning && isTerminal ? false : curr.reasonedOpen ?? !isTerminal,
              toolsOpen: wasRunning && isTerminal ? false : curr.toolsOpen ?? !isTerminal,
            };
            return updated;
          } else {
            const startTime = jobData.submitted_at ? new Date(jobData.submitted_at).getTime() : Date.now() - 3000;
            const endTime = jobData.completed_at ? new Date(jobData.completed_at).getTime() : Date.now();
            const durationSecs = parseFloat(((endTime - startTime) / 1000).toFixed(1));

            const userMsg: MessageTurn = {
              id: `user-${jobData.id}`,
              sender: 'user',
              content: jobData.description,
              timestamp: jobData.submitted_at || new Date().toISOString(),
              jobId: jobData.id,
            };

            const assistantMsg: MessageTurn = {
              id: `assistant-${jobData.id}`,
              sender: 'assistant',
              content: jobData.result || '',
              timestamp: jobData.completed_at || jobData.submitted_at || new Date().toISOString(),
              startedAt: startTime,
              completedAt: endTime,
              durationSecs: durationSecs > 0 ? durationSecs : 2.8,
              jobId: jobData.id,
              status: jobData.status,
              subtasks,
              result: jobData.result,
              error: jobData.error,
              buyerTx: jobData.buyer_tx || jobData.transaction_hash,
              reasonedOpen: !isTerminal,
              toolsOpen: !isTerminal,
            };

            return [userMsg, assistantMsg];
          }
        });

        // If terminal state reached, stop polling immediately and do NOT schedule any further requests
        if (isTerminal) {
          stopPolling('terminal state');
          fetchRecentJobs();
          return;
        }

        // Schedule next poll ONLY if non-terminal
        if (!isCancelled) {
          pollingTimerRef.current = setTimeout(poll, 1800);
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          return;
        }
        console.error('[Job Poller] Error fetching job status:', err);
        if (!isCancelled) {
          pollingTimerRef.current = setTimeout(poll, 2500);
        }
      }
    }

    // Initial fetch
    void poll();

    return () => {
      isCancelled = true;
      controller.abort();
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      activePollingJobIdRef.current = null;
    };
  }, [currentJobId, fetchRecentJobs]);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle message submission
  async function handleSendPrompt(textToSend?: string) {
    const text = (textToSend ?? promptInput).trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setPromptInput('');
    setAttachedFile(null);

    const tempJobId = `temp-${Date.now()}`;
    const startTime = Date.now();

    const userTurn: MessageTurn = {
      id: `user-${tempJobId}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      jobId: tempJobId,
    };

    const assistantTurn: MessageTurn = {
      id: `assistant-${tempJobId}`,
      sender: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      startedAt: startTime,
      jobId: tempJobId,
      status: 'planning',
      subtasks: [],
      reasonedOpen: true,
      toolsOpen: true,
    };

    // Immediately show user prompt and assistant thinking turn in conversation
    setMessages(prev => [...prev, userTurn, assistantTurn]);

    try {
      let hash: string | undefined = undefined;
      const estimatedCost = estimateJobCost(text);

      if (address) {
        try {
          hash = await sendPayment(estimatedCost, text);
        } catch (payErr) {
          console.warn('Payment signature skipped or test fallback:', payErr);
        }
      }

      const res = await submitJob(text, address || undefined, hash);
      if (res?.jobId) {
        const realId = res.jobId;
        setMessages(prev =>
          prev.map(m =>
            m.jobId === tempJobId
              ? { ...m, jobId: realId, id: `${m.sender}-${realId}` }
              : m
          )
        );
        setCurrentJobId(realId);
        window.history.replaceState(null, '', `/jobs/${realId}`);
        fetchRecentJobs();
      }
    } catch (err) {
      console.error('Job submission failed:', err);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantTurn.id
            ? {
                ...m,
                status: 'failed',
                error: (err as Error).message || 'Failed to submit multi-agent task',
                completedAt: Date.now(),
              }
            : m
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  function toggleReasoned(messageId: string) {
    setMessages(prev =>
      prev.map(m => (m.id === messageId ? { ...m, reasonedOpen: !m.reasonedOpen } : m))
    );
  }

  function toggleTools(messageId: string) {
    setMessages(prev =>
      prev.map(m => (m.id === messageId ? { ...m, toolsOpen: !m.toolsOpen } : m))
    );
  }

  function handleChipClick(chipLabel: string) {
    handleSendPrompt(chipLabel);
  }

  function scrollChips(direction: 'left' | 'right') {
    if (chipsScrollRef.current) {
      chipsScrollRef.current.scrollBy({
        left: direction === 'left' ? -220 : 220,
        behavior: 'smooth',
      });
    }
  }

  function copyText(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function handleNewChat() {
    setCurrentJobId(undefined);
    router.push('/');
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files[0]) {
      setAttachedFile(files[0]);
    }
  }

  const filteredJobs = recentJobs.filter(
    j => !searchFilter || j.description.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const activeJobTitle =
    messages.find(m => m.sender === 'user')?.content || 'AI Fitness App Landing Page';

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full bg-[#0c0c0e] text-zinc-200 overflow-hidden font-sans select-none text-[13px]">
      {/* ── BEGIN: Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={`${
          sidebarOpen ? 'w-[260px]' : 'w-0 -translate-x-full md:w-0'
        } transition-all duration-300 flex-shrink-0 bg-[#111113] border-r border-[#202024] flex flex-col justify-between h-full z-20 overflow-hidden`}
        data-purpose="sidebar-navigation"
      >
        <div className="flex flex-col flex-1 overflow-y-auto hide-scrollbar">
          {/* User Profile Header */}
          <div className="p-3 pb-2 flex items-center justify-between border-b border-[#1c1c20]">
            <div className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/40 p-1 rounded-md transition-colors flex-1 min-w-0 mr-1">
              <div className="w-6 h-6 rounded-full bg-indigo-200 flex items-center justify-center text-zinc-900 font-bold text-xs">
                <svg className="w-3.5 h-3.5 text-zinc-800" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <span className="font-medium text-xs text-zinc-200 truncate">Jessie1003</span>
              <svg className="w-3 h-3 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <button className="p-1 hover:text-zinc-200 transition-colors" title="Notifications">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:text-zinc-200 transition-colors"
                title="Collapse sidebar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M4 6h16M4 12h16M4 18h7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Action Group: New Chat */}
          <div className="p-2.5">
            <div className="flex rounded-lg bg-[#27272a]/70 hover:bg-zinc-700/60 transition-colors overflow-hidden border border-zinc-700/40 text-xs">
              <button
                onClick={handleNewChat}
                className="flex items-center gap-2 flex-1 px-3 py-2 text-zinc-200 font-medium text-left"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                </svg>
                <span>New Chat</span>
              </button>
              <div className="border-l border-zinc-600/40 flex items-center px-1.5 cursor-pointer hover:bg-zinc-600/30">
                <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </div>

          {/* Navigation List */}
          <div className="px-2 space-y-0.5">
            <div
              onClick={() => setShowSearchModal(true)}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                <span className="text-xs">Search</span>
              </div>
              <span className="text-[10px] bg-zinc-800 border border-zinc-700/60 rounded px-1.5 py-0.5 text-zinc-400 font-mono">
                Ctrl + K
              </span>
            </div>

            <Link
              href="/marketplace"
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
              <span className="text-xs">Feed / Marketplace</span>
            </Link>

            <Link
              href="/dashboard"
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
                <span className="text-xs">Dashboard</span>
              </div>
              <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </Link>
          </div>

          {/* Section: EVENTS */}
          <div className="mt-4 px-2">
            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              <div className="flex items-center gap-1 cursor-pointer hover:text-zinc-300">
                <span>EVENTS</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <button className="hover:text-zinc-200">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
            <div className="mt-0.5 flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
              <span className="text-xs">Explore events</span>
            </div>
          </div>

          {/* Section: PROJECTS */}
          <div className="mt-3 px-2">
            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              <div className="flex items-center gap-1 cursor-pointer hover:text-zinc-300">
                <span>PROJECTS</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <button className="hover:text-zinc-200">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
            <div
              onClick={handleNewChat}
              className="mt-0.5 flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
              <span className="text-xs">Create your first project</span>
            </div>
          </div>

          {/* Section: CHANNELS */}
          <div className="mt-3 px-2">
            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              <div className="flex items-center gap-1 cursor-pointer hover:text-zinc-300">
                <span>CHANNELS</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <button className="hover:text-zinc-200">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </div>
            <div className="px-2.5 py-1 text-xs text-zinc-500 italic">No channels yet</div>
          </div>

          {/* Section: CHATS */}
          <div className="mt-3 px-2 mb-4">
            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              <div className="flex items-center gap-1 cursor-pointer hover:text-zinc-300">
                <span>CHATS</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <button onClick={handleNewChat} className="hover:text-zinc-200" title="New Chat">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </div>

            {/* List of active & recent chats */}
            <div className="mt-1 space-y-1">
              {filteredJobs.length === 0 ? (
                <div
                  onClick={() =>
                    handleSendPrompt(
                      'Create a landing page for an AI-powered fitness app with a pricing section and contact form.'
                    )
                  }
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 text-zinc-200 font-medium cursor-pointer border border-zinc-700/30"
                >
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="text-xs truncate">AI Fitness App Landi...</span>
                </div>
              ) : (
                filteredJobs.slice(0, 15).map(j => {
                  const isActive = j.id === currentJobId;
                  return (
                    <div
                      key={j.id}
                      onClick={() => {
                        setCurrentJobId(j.id);
                        router.push(`/jobs/${j.id}`);
                      }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors border ${
                        isActive
                          ? 'bg-zinc-800/80 text-zinc-200 font-medium border-zinc-700/30'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border-transparent'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isActive
                            ? 'bg-indigo-400'
                            : j.status === 'completed'
                            ? 'bg-emerald-500'
                            : j.status === 'failed'
                            ? 'bg-red-500'
                            : 'bg-amber-400 animate-pulse'
                        }`}
                      />
                      <span className="truncate">{j.description}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Bottom Pinned User Profile */}
        <div
          onClick={address ? undefined : connect}
          className="p-3 border-t border-[#1c1c20] flex items-center justify-between hover:bg-zinc-800/30 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-zinc-700/80 flex items-center justify-center text-zinc-300 flex-shrink-0">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-xs font-semibold text-zinc-200 truncate">
                {address ? `Wallet (${address.slice(0, 6)}…${address.slice(-4)})` : 'Roronoa Zoro'}
              </p>
              <p className="text-[11px] text-zinc-500 truncate font-mono">
                {address && balance !== null ? `${balance} MSTC` : 'zorotheexplorer1003@gmail.com'}
              </p>
            </div>
          </div>
          <div className="text-zinc-500 pl-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </aside>
      {/* ── END: Sidebar ────────────────────────────────────────────────────────── */}

      {/* ── BEGIN: Main Chat Area ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0c0c0e] h-full relative">
        {/* Top Header Bar */}
        <header
          className="h-13 py-3 px-6 border-b border-[#1c1c20] flex items-center justify-between flex-shrink-0 bg-[#0c0c0e]/90 backdrop-blur z-10"
          data-purpose="chat-header"
        >
          <div className="flex items-center gap-3 min-w-0">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1 hover:text-zinc-200 text-zinc-400 transition-colors"
                title="Open sidebar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M4 6h16M4 12h16M4 18h7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            )}
            <div className="flex items-center gap-1.5 cursor-pointer text-zinc-200 font-semibold text-sm hover:text-white truncate">
              <h1 className="truncate max-w-md sm:max-w-xl">{activeJobTitle}</h1>
              <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-3 text-zinc-400 shrink-0">
            {currentJobId && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800/80 text-emerald-400 border border-zinc-700/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>MST Testnet Settled</span>
              </span>
            )}

            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: activeJobTitle, url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
              className="p-1 hover:text-zinc-200 transition-colors"
              title="Share chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>

            <Link href="/dashboard" className="p-1 hover:text-zinc-200 transition-colors" title="Settings / Dashboard">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </Link>
          </div>
        </header>

        {/* Scrollable Conversation Feed */}
        <div
          className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-14 py-6 space-y-7 max-w-4xl mx-auto w-full"
          data-purpose="chat-messages-container"
        >
          {messages.map(turn => {
            if (turn.sender === 'user') {
              return (
                <div key={turn.id} className="flex flex-col items-end">
                  <div className="bg-[#1e1e24] text-zinc-100 px-4 py-2.5 rounded-2xl rounded-tr-sm text-[13px] border border-zinc-700/40 shadow-sm max-w-[85%] leading-relaxed">
                    {turn.content}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-zinc-500">
                    <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    <span>{formatTime(turn.timestamp)}</span>
                  </div>
                </div>
              );
            }

            // Assistant Turn
            const subtasksList = turn.subtasks || [];
            const isTurnRunning = turn.status && !DONE_STATUSES.has(turn.status);
            const isTurnFailed = turn.status === 'failed';
            const decompositionThoughts = generateDecompositionThoughts(
              messages.find(m => m.sender === 'user' && m.jobId === turn.jobId)?.content || 'Task query',
              subtasksList
            );

            const toolNames =
              subtasksList.length > 0
                ? subtasksList.map(st => st.agent_name || `${st.skill} Agent`).join(', ')
                : isTurnRunning
                  ? 'Matching capabilities...'
                  : 'No tools executed';

            return (
              <div key={turn.id} className="flex items-start gap-3">
                {/* Assistant Avatar */}
                <div className="w-7 h-7 rounded-full bg-indigo-200 flex-shrink-0 flex items-center justify-center text-zinc-900 mt-0.5">
                  <svg className="w-4 h-4 text-zinc-800" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>

                {/* Assistant Message Body */}
                <div className="flex-1 min-w-0 space-y-4">
                  {/* Title & Handle & Live Elapsed Timer */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-zinc-200 text-xs">Jessie1003</span>
                    <span className="text-zinc-500 text-xs">@jessie1003</span>
                    <ThinkingTimer
                      isRunning={Boolean(isTurnRunning)}
                      startedAt={turn.startedAt}
                      durationSecs={turn.durationSecs}
                    />
                  </div>

                  {/* ── REASONED ACCORDION ── */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleReasoned(turn.id)}
                      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-medium cursor-pointer transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                      <span>Reasoned</span>
                      <svg
                        className={`w-3 h-3 ml-0.5 transition-transform ${turn.reasonedOpen ? '' : 'rotate-180'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </button>

                    {/* Chain of thought text */}
                    <AnimatePresence>
                      {turn.reasonedOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="text-[12px] text-zinc-400/90 leading-relaxed font-normal space-y-2 pl-2 border-l border-zinc-800/80">
                            {isTurnRunning && (
                              <div className="flex items-center gap-2 text-amber-400/90 font-mono text-[11px] pb-1">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <span>
                                  {turn.status === 'planning'
                                    ? 'Understanding task & decomposing into optimal specialized agents...'
                                    : 'Orchestrating agent execution pipeline & routing context...'}
                                </span>
                              </div>
                            )}
                            {decompositionThoughts.map((t, idx) => (
                              <p key={idx}>{t}</p>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── TOOL EXECUTION BOX / EXECUTED TOOLS SECTION ── */}
                  <div className="bg-[#141418] border border-zinc-800 rounded-xl p-3 text-xs space-y-2.5 max-w-2xl">
                    <div
                      onClick={() => toggleTools(turn.id)}
                      className="flex items-center justify-between text-zinc-300 font-medium cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {isTurnRunning ? (
                          <svg className="w-4 h-4 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              clipRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              fillRule="evenodd"
                            />
                          </svg>
                        )}
                        <span>
                          {subtasksList.length > 0
                            ? `${isTurnRunning ? 'Executing' : 'Executed'} ${subtasksList.length} tools: ${toolNames}`
                            : isTurnRunning
                              ? 'Matching agent capabilities from AgentMesh registry...'
                              : 'No tools executed'}
                        </span>
                      </div>
                      <svg
                        className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${turn.toolsOpen ? '' : '-rotate-90'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </div>

                    {/* Steps list */}
                    <AnimatePresence>
                      {turn.toolsOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-1.5 pt-1 pl-1">
                            {subtasksList.length === 0 ? (
                              <div className="flex items-center gap-2 py-2 px-1 text-zinc-400 text-xs">
                                {isTurnRunning ? (
                                  <>
                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                    <span className="text-zinc-400">Decomposing task and matching agent registry capabilities...</span>
                                  </>
                                ) : (
                                  <span className="text-zinc-500">No subtasks recorded</span>
                                )}
                              </div>
                            ) : (
                              subtasksList.map((st, i) => {
                                const stKey = `${turn.id}-${st.id || i}`;
                                const isSelected = selectedSubtaskIndex === stKey;
                                const isBlocked = st.status === 'blocked';
                                const isFailed = st.status === 'failed';
                                const isRunning = st.status === 'running';
                                const isRetrying = st.status === 'retrying';
                                const isCompleted = st.status === 'completed' || st.status === 'settled';

                                return (
                                  <div key={stKey} className="border-b border-zinc-800/50 pb-1.5 last:border-b-0">
                                    <div
                                      onClick={() => setSelectedSubtaskIndex(isSelected ? null : stKey)}
                                      className="flex items-center justify-between text-zinc-400 hover:text-zinc-200 cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm">
                                          {isBlocked ? '⊘' : SKILL_EMOJI[st.skill] || '⚙️'}
                                        </span>
                                        <span className={`font-medium ${isBlocked ? 'text-zinc-500 line-through' : isFailed ? 'text-red-400' : 'text-zinc-300'}`}>
                                          {st.agent_name || `${st.skill} Agent`}
                                        </span>
                                      </div>

                                      {isRunning ? (
                                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono animate-pulse">
                                          Running...
                                        </span>
                                      ) : isRetrying ? (
                                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono animate-pulse">
                                          Retrying...
                                        </span>
                                      ) : isFailed ? (
                                        <span className="text-[10px] bg-red-950/80 text-red-300 border border-red-800/50 px-1.5 py-0.5 rounded font-medium">
                                          Failed
                                        </span>
                                      ) : isBlocked ? (
                                        <span className="text-[10px] bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 px-1.5 py-0.5 rounded font-mono">
                                          Blocked
                                        </span>
                                      ) : isCompleted ? (
                                        <span className="text-[11px] text-emerald-400 font-medium">
                                          ✓ Result
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-zinc-500 font-mono">
                                          Waiting
                                        </span>
                                      )}
                                    </div>

                                    {/* Expandable subtask output / error / blocking reason */}
                                    {isSelected && (
                                      <div className="mt-2 text-[11px] text-zinc-400 bg-black/40 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                                        {isBlocked && (
                                          <div className="text-amber-400/90 text-[11px] font-mono">
                                            ⚠️ {st.error || 'Blocked because prerequisite task in dependency chain failed.'}
                                          </div>
                                        )}
                                        {isFailed && (
                                          <div className="text-red-400 text-[11px]">
                                            ✗ Failure Reason: {st.error || 'Output validation or agent execution failed.'}
                                          </div>
                                        )}
                                        {st.result && (
                                          <>
                                            <div className="font-mono text-zinc-500 mb-1 text-[10px]">
                                              Tokens: {st.tokens_used} · Quality: {st.quality_score}
                                              {st.payment_tx && (
                                                <a
                                                  href={getExplorerUrl(st.payment_tx)}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="ml-2 text-cyan-400 hover:underline"
                                                >
                                                  MSTScan TX ↗
                                                </a>
                                              )}
                                            </div>
                                            <div className="mt-2">
                                              <ArtifactRenderer rawContent={st.result} sourceAgent={st.agent_name || st.skill} />
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── ASSISTANT TEXT CONTENT / ACTUAL PRODUCED OUTPUT ── */}
                  <div className="text-[13px] text-zinc-300 leading-relaxed space-y-3 pt-1">
                    {turn.error ? (
                      <div className="text-red-400 bg-red-950/20 border border-red-800/40 rounded-xl p-3 text-xs">
                        ⚠️ {turn.error}
                      </div>
                    ) : turn.result ? (
                      <div className="space-y-3">
                        <ArtifactRenderer rawContent={turn.result} />
                      </div>
                    ) : isTurnRunning ? (
                      <div className="flex items-center gap-2 text-zinc-400 text-xs py-2">
                        <svg className="w-4 h-4 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>
                          {turn.status === 'planning' || subtasksList.length === 0
                            ? 'Decomposing task and matching agent registry capabilities...'
                            : subtasksList.some(s => s.status === 'running' || s.status === 'retrying')
                              ? `Executing specialized agents (${subtasksList.filter(s => s.status === 'completed' || s.status === 'settled').length}/${subtasksList.length} completed)...`
                              : 'Synthesizing output across selected agents...'}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* ── ARTIFACT CARD COMPONENT ── */}
                  {turn.result && (
                    <div
                      onClick={() => copyText(turn.id, turn.result || '')}
                      className="bg-[#17171c] hover:bg-[#1a1a20] transition-colors border border-zinc-800 rounded-xl p-3 flex items-center justify-between cursor-pointer max-w-2xl group shadow-md"
                      data-purpose="artifact-card"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-emerald-400 shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.8"
                            />
                          </svg>
                        </div>
                        <div className="leading-tight truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-zinc-100 text-xs group-hover:text-white truncate">
                              {truncateStr(
                                messages.find(m => m.sender === 'user' && m.jobId === turn.jobId)?.content ||
                                  'Execution Deliverable',
                                40
                              )}
                            </span>
                            <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                clipRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                fillRule="evenodd"
                              />
                            </svg>
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">Created • markdown / artifact</div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            Multi-agent output ({turn.result?.length || 0} characters).
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-zinc-400 group-hover:text-zinc-200 shrink-0">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (turn.jobId && !turn.jobId.startsWith('temp-')) {
                              window.open(`/api/jobs/${turn.jobId}/pdf`, '_blank');
                            } else {
                              copyText(turn.id, turn.result || '');
                            }
                          }}
                          className="p-1 hover:text-white"
                          title="Download Report / PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                            />
                          </svg>
                        </button>
                        <span className="text-xs font-mono text-emerald-400 font-medium">
                          {copiedId === turn.id ? '✓ Copied' : 'Open'}
                        </span>
                        <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="text-[11px] text-zinc-500 pt-1">{formatTime(turn.timestamp)}</div>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* ── BEGIN: Bottom Interaction Area ────────────────────────────────────── */}
        <footer
          className="p-4 md:px-8 lg:px-14 pb-5 flex flex-col items-center max-w-4xl mx-auto w-full flex-shrink-0"
          data-purpose="chat-input-container"
        >
          {/* Suggestion Action Chips Bar */}
          <div className="w-full flex items-center gap-2 mb-3 overflow-hidden">
            {/* Left green scroll arrow */}
            <button
              onClick={() => scrollChips('left')}
              className="w-6 h-6 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
              title="Scroll left"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </svg>
            </button>

            {/* Chips Carousel items */}
            <div
              ref={chipsScrollRef}
              className="flex items-center gap-2 overflow-x-auto hide-scrollbar whitespace-nowrap text-xs flex-1"
            >
              {DEFAULT_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChipClick(chip.label)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#18181c] border border-zinc-700/60 hover:border-zinc-500 text-zinc-200 transition-colors shrink-0"
                >
                  {chip.icon === 'sparkles' && (
                    <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  )}
                  {chip.icon === 'currency' && (
                    <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  )}
                  {chip.icon === 'heart' && (
                    <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  )}
                  {chip.icon === 'code' && <span className="text-zinc-400 font-mono text-xs">&lt;/&gt;</span>}
                  {chip.icon === 'sql' && <span className="text-amber-400 font-mono text-xs">SQL</span>}
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>

            {/* Right green scroll arrow */}
            <button
              onClick={() => scrollChips('right')}
              className="w-6 h-6 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 flex items-center justify-center flex-shrink-0 transition-colors shadow-sm ml-auto"
              title="Scroll right"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </svg>
            </button>
          </div>

          {/* Attached file preview */}
          {attachedFile && (
            <div className="w-full mb-2 flex items-center justify-between px-3 py-1.5 bg-[#1e1e24] border border-zinc-700/60 rounded-xl text-xs">
              <div className="flex items-center gap-2 truncate">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
                <span className="text-zinc-200 truncate">{attachedFile.name}</span>
                <span className="text-zinc-500 font-mono text-[10px]">({Math.round(attachedFile.size / 1024)} KB)</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="text-zinc-400 hover:text-white ml-2 text-sm leading-none"
              >
                ✕
              </button>
            </div>
          )}

          {/* Modern Prompt Input Box */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendPrompt();
            }}
            className="w-full bg-[#16161b] border border-[#2b2b33] focus-within:border-zinc-500 rounded-2xl p-3 shadow-lg transition-all"
          >
            {/* Target recipient row */}
            <div className="flex items-center justify-between pb-2 text-xs border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-[11px]">To:</span>
                <div className="flex items-center gap-1.5 bg-[#25252d] px-2 py-0.5 rounded-full border border-zinc-700/50">
                  <div className="w-3.5 h-3.5 rounded-full bg-indigo-200 flex items-center justify-center text-zinc-900 text-[9px] font-bold">
                    J
                  </div>
                  <span className="text-zinc-200 text-[11px] font-medium">Jessie1003</span>
                  <span className="text-[9px] bg-zinc-700 text-zinc-300 px-1 rounded">AI</span>
                </div>
                <span className="text-zinc-500 text-[11px] hidden sm:inline">Type a handle to mention a user or AI</span>
              </div>

              {webSearchActive && (
                <span className="text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.5 rounded font-mono">
                  🌐 Web Search ON
                </span>
              )}
            </div>

            {/* Input field */}
            <div className="pt-2 pb-1">
              <textarea
                ref={textareaRef}
                rows={1}
                value={promptInput}
                onChange={e => setPromptInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPrompt();
                  }
                }}
                placeholder="Ask anything, / for skills, or @handle to reach a user or AI directly..."
                disabled={submitting}
                className="w-full bg-transparent border-0 p-0 text-xs md:text-[13px] text-zinc-200 placeholder-zinc-500 focus:ring-0 focus:outline-none resize-none"
              />
            </div>

            {/* Hidden file input */}
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

            {/* Action tools & Send row */}
            <div className="flex items-center justify-between pt-2 text-zinc-400">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="hover:text-zinc-200 transition-colors p-0.5"
                  title="Add attachment"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setPromptInput(p => p + ' 🚀 ')}
                  className="hover:text-zinc-200 transition-colors p-0.5"
                  title="Insert emoji"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setWebSearchActive(v => !v)}
                  className={`transition-colors p-0.5 ${webSearchActive ? 'text-cyan-400' : 'hover:text-zinc-200'}`}
                  title="Toggle Web search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!promptInput.trim() || submitting}
                  className="w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 flex items-center justify-center transition-colors shadow-sm disabled:opacity-40 disabled:hover:bg-emerald-500"
                  title="Send message / Execute multi-agent task"
                >
                  {submitting ? (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </form>
        </footer>
        {/* ── END: Bottom Interaction Area ──────────────────────────────────────── */}
      </main>
      {/* ── END: Main Chat Area ─────────────────────────────────────────────────── */}

      {/* ── Search Modal (Ctrl + K) ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSearchModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSearchModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -10 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#141418] border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="p-3 border-b border-zinc-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                <input
                  type="text"
                  autoFocus
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder="Search chats, tasks, agent jobs..."
                  className="bg-transparent border-0 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-0 flex-1"
                />
                <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-mono">ESC</span>
              </div>
              <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                {filteredJobs.length === 0 ? (
                  <p className="text-center py-6 text-zinc-500 text-xs">No matching chats found.</p>
                ) : (
                  filteredJobs.map(j => (
                    <div
                      key={j.id}
                      onClick={() => {
                        setCurrentJobId(j.id);
                        setShowSearchModal(false);
                        router.push(`/jobs/${j.id}`);
                      }}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-800/60 cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                        <span className="text-zinc-200 truncate">{j.description}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 ml-2 shrink-0">{j.status}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
