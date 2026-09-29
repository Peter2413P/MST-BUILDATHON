import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query, exec, flushNow, reloadFromBlob } from '@/lib/server/db';
import { slashAgent } from '@/lib/server/runner';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let rows = await query('SELECT * FROM jobs WHERE id = ?', [id]);
    // Warm lambda or worker may have stale in-memory DB — reload from blob/disk on miss or in-flight job
    if (!rows[0] || (rows[0].status !== 'completed' && rows[0].status !== 'failed')) {
      await reloadFromBlob();
      rows = await query('SELECT * FROM jobs WHERE id = ?', [id]);
    }
    if (!rows[0]) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    const job = rows[0];
    const subtasks = await query(
      `SELECT st.*, COALESCE(a.name, st.skill || ' Agent') as agent_name
       FROM subtasks st LEFT JOIN agents a ON a.id = st.agent_id
       WHERE st.job_id = ? ORDER BY st.position`,
      [id]
    );
    const parsedSubtasks = (subtasks as any[]).map(s => {
      let deps: string[] = [];
      try {
        if (typeof s.dependencies === 'string') deps = JSON.parse(s.dependencies);
        else if (Array.isArray(s.dependencies)) deps = s.dependencies;
      } catch {
        deps = [];
      }
      return { ...s, dependencies: deps, optional: Boolean(s.optional) };
    });
    const escrowMetadata = (job.escrow_task_id || job.escrow_contract)
      ? {
          enabled: true,
          contractAddress: (job.escrow_contract as string) || undefined,
          taskId: (job.escrow_task_id as string) || undefined,
          fundingTxHash: ((job.buyer_tx || job.escrow_tx) as string) || null,
          settlementTxHash: (job.settlement_tx as string) || null,
          refundTxHash: (job.refund_tx as string) || null,
          status: (job.status === 'completed' || job.status === 'settled')
            ? ('completed' as const)
            : (job.status === 'failed' ? ('refunded' as const) : ('funded' as const)),
        }
      : undefined;

    return NextResponse.json({ ...job, escrow: escrowMetadata, subtasks: parsedSubtasks });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json() as { buyer_tx?: string; payer_address?: string };
    if (body.buyer_tx && body.buyer_tx.startsWith('0x')) {
      if (body.payer_address) {
        await exec('UPDATE jobs SET buyer_tx = ?, payer_address = ? WHERE id = ?', [body.buyer_tx, body.payer_address, id]);
      } else {
        await exec('UPDATE jobs SET buyer_tx = ? WHERE id = ?', [body.buyer_tx, id]);
      }
      try {
        await exec(
          'INSERT INTO transactions (id, job_id, agent_id, amount_usdc, tx_hash, demo, from_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), id, 'agent-summarizer', 0.01, body.buyer_tx, 0, body.payer_address || '0x6001712aE72d24Babc386866d035b6d55331E634']
        );
      } catch {
        // Non-blocking
      }
      await flushNow();
      return NextResponse.json({ success: true, buyer_tx: body.buyer_tx });
    }
    return NextResponse.json({ error: 'Valid buyer_tx starting with 0x required' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { agent_id, reason } = await req.json() as { agent_id?: string; reason?: string };
    if (!agent_id) return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
    const result = await slashAgent(agent_id, id, reason ?? 'Output flagged by requester');
    return NextResponse.json({ slashed: true, slashedAmount: result.slashed, newBond: result.newBond });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
