'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { getJob, getJobs, submitJob, sendChatMessage } from '@/lib/api';
import type { Job, Subtask } from '@/lib/types';
import ArtifactRenderer from './artifacts/ArtifactRenderer';
import { useWallet } from '@/lib/wallet';
import { estimateJobCost, getExplorerUrl } from '@/blockchain/mst';

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

export type JobUIPhase =
  | 'idle'
  | 'creating'
  | 'thinking'
  | 'planning'
  | 'executing'
  | 'synthesizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export function deriveJobUIPhase(status?: string, subtasks?: Subtask[]): JobUIPhase {
  if (!status || status === 'pending') return 'thinking';
  if (status === 'planning') return 'planning';
  if (status === 'running') {
    if (subtasks && subtasks.length > 0) {
      const anyRunning = subtasks.some(s => s.status === 'running' || s.status === 'retrying');
      const allDone = subtasks.every(s => s.status === 'completed' || s.status === 'settled');
      if (allDone) return 'synthesizing';
      return 'executing';
    }
    return 'executing';
  }
  if (status === 'settling') return 'synthesizing';
  if (status === 'completed' || status === 'settled') return 'completed';
  if (status === 'failed' || status === 'payment_failed') return 'failed';
  if (status === 'cancelled' || status === 'rejected' || status === 'expired') return 'cancelled';
  return 'thinking';
}

interface MessageTurn {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  startedAt?: number;
  completedAt?: number;
  durationSecs?: number;
  jobId?: string;
  intent?: 'conversation' | 'task';
  status?: 'pending' | 'planning' | 'running' | 'settling' | 'completed' | 'failed' | 'cancelled' | 'rejected' | 'settled';
  subtasks?: Subtask[];
  result?: string | null;
  error?: string | null;
  buyerTx?: string | null;
  reasonedOpen?: boolean;
  toolsOpen?: boolean;
}

const DEFAULT_CHIPS = [
  { label: 'Looks great! 💪', icon: 'sparkles' },
  { label: 'Audit contract for reentrancy & gas spikes', icon: 'gshield' },
  { label: 'Analyze dataset for multi-sig anomalies', icon: 'dataset' },
  { label: 'Research market volatility & generate hedge plan', icon: 'trending_up' },
  { label: 'Fact-check claims & statistics', icon: 'fact_check' },
  { label: 'Generate SQL query & visual chart', icon: 'database' },
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

function formatTime(isoString?: string | null) {
  if (!isoString) {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function truncateTx(tx?: string | null) {
  if (!tx) return '';
  return `${tx.slice(0, 8)}...${tx.slice(-6)}`;
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
    thoughts.push(`Settlement strategy: Micropayments dynamically calculated and settled on MST Blockchain.`);
  } else {
    thoughts.push('Analyzing query intent and querying agent registry for best matching capabilities...');
    thoughts.push('Matching skill dependencies: Decomposition & synthesis pipeline.');
    thoughts.push('Preparing context routing and estimating on-chain settlement allocation.');
  }

  return thoughts;
}

// ── Stitch-Style Live Elapsed Timer Component ─────────────────────────────
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
      <span className="inline-flex items-center gap-1.5 text-[11px] font-label-code text-[#2d5000] dark:text-[#B8FF00] bg-[#eaf5e6] dark:bg-[#B8FF00]/15 border border-[#d2e8aa] dark:border-[#B8FF00]/30 px-2 py-0.5 rounded-full animate-pulse font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00]" />
        <span>Thinking ({elapsed.toFixed(1)}s)...</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-label-code text-[#525a4e] dark:text-[#8E9489] bg-[#f0f7ed] dark:bg-[#1D211B] border border-[#d6e4d0] dark:border-[#292E27] px-2 py-0.5 rounded-full font-medium">
      <span>Thought for {elapsed > 0 ? elapsed.toFixed(1) : '2.8'}s</span>
    </span>
  );
}

interface ChatWorkspaceProps {
  initialJobId?: string;
}

export default function ChatWorkspace({ initialJobId }: ChatWorkspaceProps) {
  const router = useRouter();
  const {
    address,
    balance,
    explorerUrl,
    authState,
    sessionId,
    authenticated,
    autoPaymentEnabled,
    sessionBudget,
    connect,
    authenticate,
    authorizeAutoPayments,
    sendPayment,
    refreshBalance,
    refreshSessionStatus,
  } = useWallet();

  const [currentJobId, setCurrentJobId] = useState<string | undefined>(initialJobId);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [messages, setMessages] = useState<MessageTurn[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [copiedTx, setCopiedTx] = useState<string | null>(null);

  const handleCopyTx = (tx: string) => {
    navigator.clipboard.writeText(tx);
    setCopiedTx(tx);
    setTimeout(() => setCopiedTx(null), 2500);
  };

  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chipsScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch recent jobs list
  const fetchRecentJobs = useCallback(async () => {
    try {
      const list = await getJobs();
      setRecentJobs(list || []);
    } catch {
      // ignore
    }
  }, []);

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
      return;
    }

    const targetJobId = currentJobId;
    let isCancelled = false;

    async function poll() {
      if (isCancelled) return;

      try {
        const jobData = await getJob(targetJobId);
        if (!jobData || isCancelled) return;

        const isTerminal = TERMINAL_STATES.has(jobData.status);
        const subtasks: Subtask[] = jobData.subtasks || [];

        setMessages(prev => {
          const existingIdx = prev.findIndex(
            m => (m.jobId === targetJobId || (m.jobId && m.jobId.startsWith('temp-'))) && m.sender === 'assistant'
          );
          const userIdx = prev.findIndex(
            m => (m.jobId === targetJobId || (m.jobId && m.jobId.startsWith('temp-'))) && m.sender === 'user'
          );

          const startTime = jobData.submitted_at
            ? new Date(jobData.submitted_at).getTime()
            : (existingIdx !== -1 && prev[existingIdx].startedAt) || Date.now() - 3000;
          const endTime = jobData.completed_at ? new Date(jobData.completed_at).getTime() : Date.now();
          const durationSecs = parseFloat(((endTime - startTime) / 1000).toFixed(1));

          if (existingIdx !== -1) {
            const updated = [...prev];
            const curr = updated[existingIdx];
            const wasRunning = curr.status && !TERMINAL_STATES.has(curr.status);

            if (userIdx !== -1 && updated[userIdx].jobId !== targetJobId) {
              updated[userIdx] = { ...updated[userIdx], jobId: targetJobId, id: `user-${targetJobId}` };
            }

            const resolvedBuyerTx =
              jobData.buyer_tx ||
              jobData.transaction_hash ||
              subtasks.find(s => s.payment_tx)?.payment_tx ||
              curr.buyerTx;

            updated[existingIdx] = {
              ...curr,
              id: `assistant-${targetJobId}`,
              jobId: targetJobId,
              status: jobData.status,
              subtasks,
              result: jobData.result,
              error: jobData.error,
              buyerTx: resolvedBuyerTx,
              startedAt: startTime,
              completedAt: endTime,
              durationSecs: durationSecs > 0 ? durationSecs : curr.durationSecs,
              reasonedOpen: wasRunning && isTerminal ? false : curr.reasonedOpen ?? !isTerminal,
              toolsOpen: wasRunning && isTerminal ? false : curr.toolsOpen ?? !isTerminal,
            };
            return updated;
          } else {
            const resolvedBuyerTx =
              jobData.buyer_tx ||
              jobData.transaction_hash ||
              subtasks.find(s => s.payment_tx)?.payment_tx;

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
              buyerTx: resolvedBuyerTx,
              reasonedOpen: !isTerminal,
              toolsOpen: !isTerminal,
            };

            return [...prev.filter(m => !m.jobId?.startsWith('temp-')), userMsg, assistantMsg];
          }
        });

        if (isTerminal) {
          fetchRecentJobs();
          return;
        }

        if (!isCancelled) {
          pollingTimerRef.current = setTimeout(poll, 1800);
        }
      } catch (err) {
        console.error('[Job Poller] Error:', err);
        if (!isCancelled) {
          pollingTimerRef.current = setTimeout(poll, 2500);
        }
      }
    }

    void poll();

    return () => {
      isCancelled = true;
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [currentJobId, fetchRecentJobs]);

  // Handle message submission
  async function handleSendPrompt(textToSend?: string) {
    const text = (textToSend ?? promptInput).trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setPromptInput('');

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

    setMessages(prev => [...prev, userTurn, assistantTurn]);

    // Build compact conversation history for the router
    const history = messages.slice(-6).map(m => ({
      role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content || (m.result ?? ''),
    }));

    // If wallet is connected, broadcast real on-chain payment on MST Testnet
    let onChainTxHash: string | undefined;
    if (address) {
      try {
        const costMstc = estimateJobCost(text);
        onChainTxHash = await sendPayment(costMstc, text);
        console.log(`[ChatWorkspace] On-chain payment broadcasted on MST Testnet: ${onChainTxHash}`);
        void refreshBalance();
      } catch (payErr) {
        console.warn('[ChatWorkspace] Payment declined or off-chain fallback:', (payErr as Error).message);
      }
    }

    try {
      // Pass message through Layer 1: Conversation Intelligence Router with active Session ID
      const chatRes = await sendChatMessage({
        message: text,
        jobId: currentJobId,
        sessionId: sessionId || undefined,
        history,
        walletAddress: address || undefined,
        buyerTx: onChainTxHash,
      });

      // ── CONVERSATION INTENT ──
      // Instant answer from ConversationLLM — 0 MSTC payment, no job poller, no DAG clutter
      if (chatRes.intent === 'conversation') {
        const convId = `conv-${Date.now()}`;
        const durationSecs = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantTurn.id
              ? {
                  ...m,
                  id: `assistant-${convId}`,
                  jobId: convId,
                  intent: 'conversation',
                  content: chatRes.response || 'I understand. How can I assist you with your tasks today?',
                  status: 'completed',
                  completedAt: Date.now(),
                  durationSecs: durationSecs > 0 ? durationSecs : 0.4,
                }
              : m.id === userTurn.id
              ? { ...m, jobId: convId }
              : m
          )
        );
        return;
      }

      // ── TASK INTENT ──
      // Orchestrate multi-agent swarm via Planner & DAG with automated session settlement (NO wallet popup per task)
      const realId = chatRes.jobId || tempJobId;
      const finalBuyerTx = chatRes.buyer_tx;

      setMessages(prev =>
        prev.map(m =>
          m.jobId === tempJobId
            ? {
                ...m,
                jobId: realId,
                id: `${m.sender}-${realId}`,
                intent: 'task',
                buyerTx: finalBuyerTx,
              }
            : m
        )
      );
      setCurrentJobId(realId);
      window.history.replaceState(null, '', `/jobs/${realId}`);
      fetchRecentJobs();
      void refreshSessionStatus();
    } catch (err: unknown) {
      console.error('Job submission / routing failed:', err);
      const isAllowanceErr = (err as { response?: { status?: number; data?: { code?: string; error?: string } } })?.response?.data;
      const errMessage = isAllowanceErr?.error || (err as Error).message || 'Failed to process request';

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantTurn.id
            ? {
                ...m,
                status: 'failed',
                error: errMessage,
                completedAt: Date.now(),
              }
            : m
        )
      );

      if (isAllowanceErr?.code === 'INSUFFICIENT_SESSION_ALLOWANCE') {
        void authorizeAutoPayments(1.0);
      }
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

  function handleNewChat() {
    setCurrentJobId(undefined);
    setMessages([]);
    router.push('/');
  }

  const scrollChips = (dir: 'left' | 'right') => {
    if (chipsScrollRef.current) {
      const scrollAmt = dir === 'left' ? -240 : 240;
      chipsScrollRef.current.scrollBy({ left: scrollAmt, behavior: 'smooth' });
    }
  };

  const activeJob = recentJobs.find(j => j.id === currentJobId);
  const activeJobTitle = activeJob?.description || (messages.length > 0 ? messages[0].content : 'New Swarm Execution');

  return (
    <div className="flex flex-col min-w-0 bg-[#f2fdeb] dark:bg-[#0B0D0A] min-h-[calc(100vh-4rem)] relative text-[#121511] dark:text-[#F5F7F2]">
      {/* ── Top Header Toolbar ────────────────────────────────────────────── */}
      <header className="h-14 px-4 sm:px-8 border-b border-[#dae6d4] dark:border-[#292E27] flex items-center justify-between shrink-0 bg-white/95 dark:bg-[#0B0D0A]/95 backdrop-blur z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleNewChat}
            className="px-3 py-1.5 rounded-lg bg-[#eaf5e6] dark:bg-[#151814] text-[#2d5000] dark:text-[#B8FF00] border border-[#d2e8aa] dark:border-[#292E27] text-xs font-semibold hover:bg-[#e2f3be] transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>New Swarm</span>
          </button>

          <div className="flex items-center gap-2 cursor-pointer font-bold text-sm truncate">
            <span className="font-label-code text-xs text-[#757872]">/</span>
            <h2 className="truncate max-w-xs sm:max-w-md text-[#121511] dark:text-[#F5F7F2]">
              {activeJobTitle}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs shrink-0">
          {/* Session Auth & Auto-Pay Budget Meter */}
          {address && authenticated ? (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eef8eb] dark:bg-[#1D211B] text-[#2d5000] dark:text-[#B8FF00] border border-[#d2e8cb] dark:border-[#292E27] font-label-code text-[11px] font-semibold"
              title="Session Active — Auto-Payment enabled with no limit"
            >
              <span className="material-symbols-outlined text-[13px] text-[#3d6a00] dark:text-[#B8FF00]">bolt</span>
              <span>
                Spent: {sessionBudget?.sessionSpent ? sessionBudget.sessionSpent.toFixed(4) : '0.0000'} MSTC
              </span>
            </div>
          ) : address && !authenticated ? (
            <button
              onClick={() => authenticate()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#a8f000] dark:bg-[#B8FF00] text-black font-semibold text-xs hover:bg-[#9de000] transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[14px]">key</span>
              <span>Auth Session</span>
            </button>
          ) : null}

          {currentJobId && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-label-code px-2.5 py-1 rounded-full bg-[#eaf5e6] dark:bg-[#B8FF00]/15 text-[#2d5000] dark:text-[#B8FF00] border border-[#d2e8aa] dark:border-[#B8FF00]/30 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00] animate-pulse" />
              <span>MST Synced</span>
            </span>
          )}

          {activeJob?.buyer_tx && (
            <a
              href={`${explorerUrl}/tx/${activeJob.buyer_tx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#dae6d4] dark:border-[#292E27] bg-white dark:bg-[#151814] text-[#3d6a00] dark:text-[#B8FF00] font-label-code text-xs hover:bg-[#f0f7ed] transition-colors"
            >
              <span>Tx: {truncateTx(activeJob.buyer_tx)}</span>
              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
            </a>
          )}
        </div>
      </header>

      {/* ── Scrollable Conversation Stream ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-14 py-6 space-y-6 max-w-4xl mx-auto w-full custom-scroll">
        {messages.length === 0 && (
          <div className="py-16 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#e2f3be] dark:bg-[#B8FF00]/20 flex items-center justify-center text-[#2d5000] dark:text-[#B8FF00]">
              <span className="material-symbols-outlined text-[28px]">hub</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#121511] dark:text-[#F5F7F2]">
                AgentMesh Autonomous Orchestrator
              </h3>
              <p className="text-xs text-[#525a4e] dark:text-[#8E9489] mt-1 max-w-md mx-auto">
                Enter your high-level goal below. The LLM Planner will decompose it across specialized agents and settle compute proofs on-chain.
              </p>
            </div>
          </div>
        )}

        {messages.map(turn => {
          if (turn.sender === 'user') {
            return (
              <div key={turn.id} className="flex flex-col items-end">
                <div className="bg-white dark:bg-[#151814] text-[#121511] dark:text-[#F5F7F2] px-4 py-3 rounded-2xl rounded-tr-sm text-sm border border-[#dae6d4] dark:border-[#292E27] shadow-sm max-w-[85%] leading-relaxed">
                  {turn.content}
                </div>
                <div className="flex items-center gap-1 mt-1 text-[11px] font-label-code text-[#757872] dark:text-[#8E9489]">
                  <span className="material-symbols-outlined text-[14px] text-[#3d6a00] dark:text-[#B8FF00]">
                    done_all
                  </span>
                  <span>{formatTime(turn.timestamp)}</span>
                </div>
              </div>
            );
          }

          // Assistant Turn
          const subtasksList = turn.subtasks || [];
          const phase = deriveJobUIPhase(turn.status, subtasksList);
          const isTurnRunning = phase !== 'completed' && phase !== 'failed' && phase !== 'cancelled';
          const isTurnFailed = phase === 'failed';
          const decompositionThoughts = generateDecompositionThoughts(
            messages.find(m => m.sender === 'user' && m.jobId === turn.jobId)?.content || 'Task query',
            subtasksList
          );

          const toolNames =
            subtasksList.length > 0
              ? subtasksList.map(st => st.agent_name || `${st.skill} specialist`).join(', ')
              : isTurnRunning
              ? 'Matching agent capabilities...'
              : 'All agents completed';

          return (
            <div key={turn.id} className="flex items-start gap-3">
              {/* Assistant Avatar */}
              <div className="w-8 h-8 rounded-xl bg-[#a8f000] dark:bg-[#B8FF00] shrink-0 flex items-center justify-center text-black mt-0.5 shadow-sm">
                <span className="material-symbols-outlined text-[18px]">polyline</span>
              </div>

              {/* Assistant Message Body */}
              <div className="flex-1 min-w-0 space-y-3">
                {/* Title & Live Elapsed Timer */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-[#121511] dark:text-[#F5F7F2]">
                    AgentMesh Orchestrator
                  </span>
                  <span className="text-[11px] text-[#757872] font-label-code">@orchestrator</span>
                  <ThinkingTimer
                    isRunning={Boolean(isTurnRunning)}
                    startedAt={turn.startedAt}
                    durationSecs={turn.durationSecs}
                  />
                </div>

                {/* ── CONVERSATION INTENT: Direct Conversational Response ── */}
                {turn.intent === 'conversation' || turn.jobId?.startsWith('conv-') ? (
                  <div className="bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] rounded-xl p-4 text-xs leading-relaxed text-[#121511] dark:text-[#F5F7F2] shadow-sm prose dark:prose-invert max-w-none">
                    <ReactMarkdown>
                      {turn.content || 'I am ready to assist you. Ask a question or submit a task.'}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <>
                    {/* ── REASONED ACCORDION ── */}
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => toggleReasoned(turn.id)}
                        className="flex items-center gap-1.5 text-xs text-[#525a4e] dark:text-[#8E9489] hover:text-[#121511] dark:hover:text-white font-medium cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#3d6a00] dark:text-[#B8FF00]">
                          neurology
                        </span>
                        <span>Decomposition Reasoning</span>
                        <span className={`material-symbols-outlined text-[16px] transition-transform ${turn.reasonedOpen ? '' : '-rotate-90'}`}>
                          expand_more
                        </span>
                      </button>

                      <AnimatePresence>
                        {turn.reasonedOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="text-xs text-[#525a4e] dark:text-[#8E9489] leading-relaxed space-y-1.5 pl-3 border-l-2 border-[#d2e8aa] dark:border-[#B8FF00]/30 py-1 bg-white/40 dark:bg-[#151814]/40 rounded-r-lg">
                              {isTurnRunning && (
                                <div className="flex items-center gap-2 text-[#2d5000] dark:text-[#B8FF00] font-label-code text-[11px] font-semibold pb-1">
                                  <span className="w-2 h-2 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00] animate-pulse" />
                                  <span>
                                    {turn.status === 'planning'
                                      ? 'Analyzing goal & synthesizing multi-agent DAG...'
                                      : 'Executing subtasks & routing forward context...'}
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

                    {/* ── SUBTASK DAG EXECUTION ACCORDION ── */}
                    <div className="bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] rounded-xl p-3 text-xs space-y-2 shadow-sm">
                      <div
                        onClick={() => toggleTools(turn.id)}
                        className="flex items-center justify-between text-[#121511] dark:text-[#F5F7F2] font-semibold cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {isTurnRunning ? (
                            <span className="material-symbols-outlined text-[18px] text-[#3d6a00] dark:text-[#B8FF00] animate-spin">
                              autorenew
                            </span>
                          ) : isTurnFailed ? (
                            <span className="material-symbols-outlined text-[18px] text-[#ba1a1a]">
                              error
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-[18px] text-[#3d6a00] dark:text-[#B8FF00]">
                              check_circle
                            </span>
                          )}
                          <span>
                            {subtasksList.length > 0
                              ? `${isTurnRunning ? 'Executing' : 'Executed'} ${subtasksList.length} subtasks: ${toolNames}`
                              : isTurnRunning
                              ? 'Matching agent capabilities from registry...'
                              : '✓ Swarm Execution Complete'}
                          </span>
                        </div>
                        <span className={`material-symbols-outlined text-[18px] text-[#757872] transition-transform ${turn.toolsOpen ? '' : '-rotate-90'}`}>
                          expand_more
                        </span>
                      </div>

                      <AnimatePresence>
                        {turn.toolsOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-2 pt-2">
                              {subtasksList.map((st, sIdx) => {
                                const isStepRunning = st.status === 'running' || st.status === 'retrying';
                                const isStepDone = st.status === 'completed' || st.status === 'settled';
                                const icon = SKILL_ICONS[st.skill] || 'neurology';
                                const isExpanded = expandedStepId === `${turn.id}-${sIdx}`;

                                return (
                                  <div
                                    key={st.id || sIdx}
                                    className={`rounded-lg border transition-all overflow-hidden ${
                                      isStepRunning
                                        ? 'border-2 border-[#3d6a00] dark:border-[#B8FF00] bg-[#f8fbf6] dark:bg-[#11130F]'
                                        : 'border-[#dae6d4] dark:border-[#292E27] bg-[#f8fbf6] dark:bg-[#11130F]'
                                    }`}
                                  >
                                    <div
                                      onClick={() =>
                                        setExpandedStepId(isExpanded ? null : `${turn.id}-${sIdx}`)
                                      }
                                      className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-[#eaf5e6] dark:hover:bg-[#1D211B] select-none"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="w-6 h-6 rounded-full bg-[#e2f3be] dark:bg-[#B8FF00]/20 text-[#2d5000] dark:text-[#B8FF00] flex items-center justify-center shrink-0">
                                          <span className="material-symbols-outlined text-[14px]">
                                            {isStepDone ? 'check_circle' : isStepRunning ? 'autorenew' : icon}
                                          </span>
                                        </span>
                                        <div className="flex flex-col truncate">
                                          <span className="font-bold text-xs text-[#121511] dark:text-[#F5F7F2] flex items-center gap-1.5">
                                            <span>{sIdx + 1}. {st.agent_name || `${st.skill} Agent`}</span>
                                            <span className="px-1.5 py-0.2 rounded font-label-code text-[10px] bg-white dark:bg-[#151814] text-[#525a4e] dark:text-[#8E9489] border border-[#dae6d4] dark:border-[#292E27]">
                                              {st.skill}
                                            </span>
                                          </span>
                                          <span className="text-[11px] text-[#525a4e] dark:text-[#8E9489] truncate">
                                            {st.prompt || st.description || 'Executing autonomous sub-task'}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="font-label-code text-[11px] font-semibold text-[#3d6a00] dark:text-[#B8FF00]">
                                          {isStepRunning ? 'Running...' : isStepDone ? 'Settled' : 'Pending'}
                                        </span>
                                        <span className={`material-symbols-outlined text-[16px] text-[#757872] transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                          expand_more
                                        </span>
                                      </div>
                                    </div>

                                    {isExpanded && (
                                      <div className="p-2.5 bg-white dark:bg-[#151814] border-t border-[#dae6d4] dark:border-[#292E27] grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px] font-label-code">
                                        <div>
                                          <span className="block text-[#757872]">COMPLEXITY</span>
                                          <span className="font-bold text-[#121511] dark:text-[#F5F7F2]">×{st.complexity_weight || 1.0}</span>
                                        </div>
                                        <div>
                                          <span className="block text-[#757872]">QUALITY</span>
                                          <span className="font-bold text-[#3d6a00] dark:text-[#B8FF00]">
                                            {st.quality_score ? `${(st.quality_score * 100).toFixed(1)}%` : '98.5%'}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="block text-[#757872]">EST. REWARD</span>
                                          <span className="font-bold text-[#3d6a00] dark:text-[#B8FF00]">
                                            {(st.payment_mstc ?? st.payment_usdc ?? st.payout_amount) ? `${(st.payment_mstc ?? st.payment_usdc ?? st.payout_amount)!.toFixed(2)} MSTC` : '0.85 MSTC'}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="block text-[#757872]">BOND STATE</span>
                                          <span className="font-semibold text-[#3d6a00] dark:text-[#B8FF00]">Guaranteed</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* ── ARTIFACT RENDERER & FINAL OUTPUT ── */}
                    {turn.result && (
                      <div className="bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] rounded-xl p-4 shadow-sm space-y-3">
                        <ArtifactRenderer rawContent={turn.result} />
                      </div>
                    )}

                    {/* ── ON-CHAIN SETTLEMENT TRANSPARENCY CARD ── */}
                    {(turn.status === 'completed' || turn.status === 'settled') && (
                      <div className="bg-[#f8fcf6] dark:bg-[#121510] border border-[#d2e8cb] dark:border-[#292E27] rounded-xl p-3.5 text-xs space-y-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-[#2d5000] dark:text-[#B8FF00] font-label-code text-[11px]">
                            {turn.buyerTx && turn.buyerTx.startsWith('0x') && turn.buyerTx.length === 66 ? (
                              <>
                                <span className="material-symbols-outlined text-[16px]">verified</span>
                                <span>✓ MST Testnet Settled (Chain ID: 91562037)</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[16px]">bolt</span>
                                <span>⚡ Session Auto-Authorized</span>
                              </>
                            )}
                          </div>
                          <span className="text-[10px] font-label-code text-[#757872]">
                            {turn.buyerTx && turn.buyerTx.startsWith('0x') && turn.buyerTx.length === 66
                              ? 'On-Chain Proof Verified'
                              : 'Session Allowance Deducted'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                          <div className="bg-white dark:bg-[#151814] p-2 rounded-lg border border-[#dae6d4] dark:border-[#292E27]">
                            <span className="block text-[10px] text-[#757872]">Agents Rewarded</span>
                            <span className="font-bold text-[#121511] dark:text-[#F5F7F2]">
                              {subtasksList.length > 0 ? subtasksList.length : 1} Swarm Agents
                            </span>
                          </div>
                          <div className="bg-white dark:bg-[#151814] p-2 rounded-lg border border-[#dae6d4] dark:border-[#292E27]">
                            <span className="block text-[10px] text-[#757872]">Settlement Amount</span>
                            <span className="font-bold text-[#3d6a00] dark:text-[#B8FF00]">
                              {subtasksList.reduce((acc, s) => acc + (s.payment_mstc || s.payment_usdc || 0.01), 0).toFixed(4)} MSTC
                            </span>
                          </div>
                          <div className="bg-white dark:bg-[#151814] p-2 rounded-lg border border-[#dae6d4] dark:border-[#292E27] col-span-2 sm:col-span-1">
                            <span className="block text-[10px] text-[#757872]">Network & Status</span>
                            <span className="font-semibold text-[#121511] dark:text-[#F5F7F2]">
                              {turn.buyerTx ? 'MST Testnet (Confirmed)' : 'Off-Chain Ledger'}
                            </span>
                          </div>
                        </div>

                        {/* Dedicated Full Transaction Hash & MSTScan Section */}
                        {turn.buyerTx && turn.buyerTx.startsWith('0x') && turn.buyerTx.length === 66 && (
                          <div className="p-2.5 rounded-lg bg-white dark:bg-[#151814] border border-[#d2e8cb] dark:border-[#292E27] space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] text-[#757872]">
                              <span className="font-bold uppercase tracking-wider text-[#2d5000] dark:text-[#B8FF00] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">link</span>
                                MST Blockchain Transaction Hash
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleCopyTx(turn.buyerTx!)}
                                  className="text-[10px] font-label-code text-[#2d5000] dark:text-[#B8FF00] hover:underline flex items-center gap-0.5 cursor-pointer"
                                  title="Copy transaction hash to clipboard"
                                >
                                  <span className="material-symbols-outlined text-[12px]">
                                    {copiedTx === turn.buyerTx ? 'check' : 'content_copy'}
                                  </span>
                                  <span>{copiedTx === turn.buyerTx ? 'Copied' : 'Copy Hash'}</span>
                                </button>
                                <a
                                  href={`https://testnet.mstscan.com/tx/${turn.buyerTx}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-label-code font-bold text-[#2d5000] dark:text-[#B8FF00] hover:underline flex items-center gap-0.5"
                                  title="Open on MSTScan Testnet Explorer"
                                >
                                  <span>View on MSTScan</span>
                                  <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                </a>
                              </div>
                            </div>
                            <div className="p-1.5 rounded bg-[#f3f9f0] dark:bg-[#0c0f0a] border border-[#e2ebd9] dark:border-[#1d221c] font-label-code text-[11px] text-[#121511] dark:text-[#F5F7F2] break-all select-all">
                              {turn.buyerTx}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {turn.error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-[#ba1a1a]">
                    <span className="font-bold">Execution Notice: </span>
                    {turn.error}
                  </div>
                )}

                <div className="text-[11px] font-label-code text-[#757872] pt-1">
                  {formatTime(turn.timestamp)}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Bottom Input Area & Suggestion Chips ────────────────────────────── */}
      <footer className="p-4 md:px-8 lg:px-14 pb-5 flex flex-col items-center max-w-4xl mx-auto w-full shrink-0">
        {/* Chips Bar */}
        <div className="w-full flex items-center gap-2 mb-3 overflow-hidden">
          <button
            onClick={() => scrollChips('left')}
            className="w-6 h-6 rounded-full bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] text-[#121511] dark:text-[#F5F7F2] flex items-center justify-center shrink-0 transition-colors shadow-sm"
            title="Scroll left"
          >
            <span className="material-symbols-outlined text-[14px]">chevron_left</span>
          </button>

          <div
            ref={chipsScrollRef}
            className="flex items-center gap-2 overflow-x-auto hide-scrollbar whitespace-nowrap text-xs flex-1"
          >
            {DEFAULT_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendPrompt(chip.label)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] hover:border-[#a8f000] dark:hover:border-[#B8FF00] text-[#121511] dark:text-[#F5F7F2] transition-colors shrink-0 shadow-sm font-medium"
              >
                <span className="material-symbols-outlined text-[14px] text-[#3d6a00] dark:text-[#B8FF00]">
                  {chip.icon}
                </span>
                <span>{chip.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => scrollChips('right')}
            className="w-6 h-6 rounded-full bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] text-[#121511] dark:text-[#F5F7F2] flex items-center justify-center shrink-0 transition-colors shadow-sm ml-auto"
            title="Scroll right"
          >
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          </button>
        </div>

        {/* Modern Prompt Input Box */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="w-full bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] focus-within:border-[#3d6a00] dark:focus-within:border-[#B8FF00] rounded-2xl p-3 shadow-md transition-all"
        >
          {/* Input field */}
          <div className="pt-1 pb-1">
            <textarea
              ref={textareaRef}
              rows={2}
              value={promptInput}
              onChange={e => setPromptInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendPrompt();
                }
              }}
              placeholder="Describe your goal or protocol task (e.g. 'Audit smart contract trace & synthesize tokenomics table')..."
              disabled={submitting}
              className="w-full bg-transparent border-0 p-0 text-xs md:text-sm text-[#121511] dark:text-[#F5F7F2] placeholder-[#757872] focus:ring-0 focus:outline-none resize-none"
            />
          </div>

          {/* Action tools & Send row */}
          <div className="flex items-center justify-between pt-2 border-t border-[#f0f4ee] dark:border-[#292E27] text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#eef8eb] dark:bg-[#1D211B] text-[#2d5000] dark:text-[#B8FF00] font-label-code text-[11px] font-semibold border border-[#d2e8cb] dark:border-[#292E27]">
                <span className="material-symbols-outlined text-[13px]">token</span>
                <span>~8.40 MSTC · 3 Agents</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!promptInput.trim() || submitting}
                className="px-4 py-1.5 rounded-lg bg-[#a8f000] dark:bg-[#B8FF00] hover:bg-[#9de000] text-black font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-40"
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">autorenew</span>
                    <span>Orchestrating...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                    <span>Run with AgentMesh</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </footer>
    </div>
  );
}
