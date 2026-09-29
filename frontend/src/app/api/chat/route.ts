import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { v4 as uuidv4 } from 'uuid';
import { query, exec, flushNow, reloadFromBlob } from '@/lib/server/db';
import { ensureSeeded } from '@/lib/server/seed';
import { routeMessage, type RouterContext } from '@/lib/server/router';
import { handleConversation } from '@/lib/server/conversation';
import { runJob } from '@/lib/server/runner';
import { anchorQueryOnChain } from '@/lib/server/mst';
import { getSession } from '@/lib/server/auth';
import type { Job, Subtask } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    await reloadFromBlob();
    await ensureSeeded();

    const authHeader = req.headers.get('authorization');
    const bearerId = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const cookieId = req.cookies.get('agentmesh_session_id')?.value;

    const body = (await req.json()) as {
      message?: string;
      jobId?: string;
      sessionId?: string;
      history?: { role: 'user' | 'assistant'; content: string; timestamp?: string }[];
      walletAddress?: string;
      buyerTx?: string;
    };

    const sessionId = body.sessionId || bearerId || cookieId || null;
    const activeSession = await getSession(sessionId);

    const message = (body.message || '').trim();
    if (!message) {
      return NextResponse.json({ error: 'message required' }, { status: 400 });
    }

    const payerAddress = activeSession?.walletAddress || body.walletAddress?.trim();
    let previousTaskContext: RouterContext['previous_task'] = null;

    // Load previous task context if jobId was provided or find recent user job
    if (body.jobId) {
      const jobRows = (await query('SELECT * FROM jobs WHERE id = ?', [body.jobId])) as unknown as Job[];
      if (jobRows && jobRows[0]) {
        const j = jobRows[0];
        const subtasks = ((await query('SELECT * FROM subtasks WHERE job_id = ? ORDER BY position ASC', [j.id])) as unknown) as Subtask[];
        const agentsUsed = subtasks.map(s => s.agent_name || s.skill).filter(Boolean) as string[];
        const settlementMstc = subtasks.reduce((sum, s) => sum + (s.payment_usdc || 0), 0);

        previousTaskContext = {
          id: j.id,
          status: j.status,
          description: j.description,
          result: j.result,
          error: j.error,
          agents_used: agentsUsed,
          settlement_mstc: settlementMstc,
        };
      }
    } else if (payerAddress) {
      // Find most recent completed or running job by this user/payer
      const recentJobRows = ((await query(
        'SELECT * FROM jobs ORDER BY submitted_at DESC LIMIT 1'
      )) as unknown) as Job[];
      if (recentJobRows && recentJobRows[0]) {
        const j = recentJobRows[0];
        previousTaskContext = {
          id: j.id,
          status: j.status,
          description: j.description,
          result: j.result,
          error: j.error,
        };
      }
    }

    const routerContext: RouterContext = {
      current_message: message,
      recent_messages: body.history || [],
      previous_task: previousTaskContext,
      wallet: {
        address: payerAddress || null,
        authenticated: Boolean(activeSession?.authenticated || payerAddress),
      },
    };

    // Layer 1: Conversation Intelligence Router
    const routerOutput = await routeMessage(routerContext);

    // ──────────────────────────────────────────────────────────────────────────
    // BRANCH A: CONVERSATION
    // ──────────────────────────────────────────────────────────────────────────
    if (routerOutput.intent === 'conversation') {
      console.log('[Router] CONVERSATION');
      console.log('[Conversation] No task created');
      console.log('[Conversation] No payment required');

      const convResponse = await handleConversation(routerContext, routerOutput);

      return NextResponse.json({
        intent: 'conversation',
        response: convResponse.text,
        requires_execution: false,
        requires_payment: false,
        router: routerOutput,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BRANCH B: TASK EXECUTION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[Task] Task classified as TASK');

    // Check session automatic task payment authorization
    if (activeSession) {
      if (activeSession.autoPaymentEnabled) {
        console.log('[Task] Payment authorization available (unlimited session budget)');
      }
    }

    console.log('[Task] Starting agent execution');

    const executableTaskDescription = routerOutput.task_summary || message;
    const newJobId = uuidv4();

    // Check if client provided a real on-chain transaction hash or broadcast via server signer
    let finalTxHash = (body.buyerTx && body.buyerTx.startsWith('0x') && body.buyerTx.length === 66) ? body.buyerTx.trim() : null;
    if (!finalTxHash) {
      finalTxHash = await anchorQueryOnChain(newJobId, executableTaskDescription, payerAddress);
    }

    const { isEscrowEnabled, calculateTaskId, MST_ESCROW_CONTRACT_ADDRESS } = await import('@/blockchain/mst/escrow');
    const escrowTaskId = isEscrowEnabled() ? calculateTaskId(newJobId) : null;
    const escrowContract = isEscrowEnabled() ? MST_ESCROW_CONTRACT_ADDRESS : null;

    console.log(`[Chat POST -> Task ${newJobId}] Creating job — payer: ${payerAddress || 'none'}, on-chain tx: ${finalTxHash || 'NONE'} escrow: ${escrowTaskId || 'legacy'}`);

    await exec(
      'INSERT INTO jobs (id, description, status, buyer_tx, payer_address, payment_status, escrow_task_id, escrow_contract) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [newJobId, executableTaskDescription, 'pending', finalTxHash, payerAddress || null, finalTxHash ? 'confirming' : 'session_authorized', escrowTaskId, escrowContract]
    );

    // Record initial query payment transaction in ledger only if a real on-chain tx exists
    if (finalTxHash) {
      try {
        await exec(
          'INSERT INTO transactions (id, job_id, agent_id, amount_usdc, tx_hash, demo, from_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), newJobId, 'agent-summarizer', 0.01, finalTxHash, 0, payerAddress || '0x6001712aE72d24Babc386866d035b6d55331E634']
        );
      } catch {
        // Non-blocking
      }
    }

    await flushNow();

    const runnerPromise = (async () => {
      try {
        console.log(`[Task ${newJobId}] Background runner starting with Planner`);
        await runJob(newJobId, executableTaskDescription, sessionId || undefined);
        console.log(`[Task ${newJobId}] Background runner complete`);
      } catch (err) {
        console.error(`[Task ${newJobId}] Fatal runner error:`, (err as Error).message);
        try {
          await exec('UPDATE jobs SET status = ?, error = ? WHERE id = ?', ['failed', (err as Error).message, newJobId]);
          await flushNow();
        } catch { /* ignore */ }
      }
    })();

    if (process.env.VERCEL) {
      try { waitUntil(runnerPromise); } catch { /* ok */ }
    } else {
      void runnerPromise;
    }

    return NextResponse.json({
      intent: 'task',
      jobId: newJobId,
      status: 'pending',
      task_summary: executableTaskDescription,
      buyer_tx: finalTxHash,
      requires_execution: true,
      requires_payment: true,
      router: routerOutput,
      sessionRemaining: activeSession ? activeSession.remaining : undefined,
    });
  } catch (err) {
    console.error('[Chat POST] Error:', (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
