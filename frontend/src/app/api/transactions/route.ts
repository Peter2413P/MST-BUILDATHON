import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query, exec, flushNow } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

const PLATFORM_ESCROW = '0x6001712aE72d24Babc386866d035b6d55331E634';

const BASE_SQL = `SELECT 
  t.id,
  t.job_id,
  t.agent_id,
  t.amount_usdc,
  t.amount_usdc as amount_mstc,
  'MSTC' as currency,
  t.tx_hash,
  t.demo,
  t.created_at,
  COALESCE(a.name, t.agent_id) as agent_name,
  COALESCE(a.skill, 'general') as agent_skill,
  COALESCE(a.wallet_address, '${PLATFORM_ESCROW}') as to_address,
  COALESCE(t.from_address, j.payer_address, '${PLATFORM_ESCROW}') as from_address,
  j.description as job_description,
  CASE WHEN t.amount_usdc <= 0.01 AND t.agent_id = 'agent-summarizer' THEN 'query_anchor' ELSE 'payout' END as type
FROM transactions t 
LEFT JOIN agents a ON a.id = t.agent_id 
LEFT JOIN jobs j ON j.id = t.job_id`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agent_id');
    const jobId = searchParams.get('job_id');
    const address = searchParams.get('address')?.toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100') || 100, 500);

    let txs;
    if (address) {
      txs = await query(
        `${BASE_SQL} WHERE LOWER(COALESCE(t.from_address, j.payer_address, '')) = ? OR LOWER(COALESCE(a.wallet_address, '')) = ? ORDER BY t.created_at DESC LIMIT ?`,
        [address, address, limit]
      );
    } else if (agentId && jobId) {
      txs = await query(`${BASE_SQL} WHERE t.agent_id = ? AND t.job_id = ? ORDER BY t.created_at DESC LIMIT ?`, [agentId, jobId, limit]);
    } else if (agentId) {
      txs = await query(`${BASE_SQL} WHERE t.agent_id = ? ORDER BY t.created_at DESC LIMIT ?`, [agentId, limit]);
    } else if (jobId) {
      txs = await query(`${BASE_SQL} WHERE t.job_id = ? ORDER BY t.created_at DESC LIMIT ?`, [jobId, limit]);
    } else {
      txs = await query(`${BASE_SQL} ORDER BY t.created_at DESC LIMIT ?`, [limit]);
    }
    return NextResponse.json(txs);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      job_id?: string;
      agent_id?: string;
      amount_mstc?: number;
      amount_usdc?: number;
      tx_hash?: string;
      demo?: number;
      from_address?: string;
    };

    if (!body.tx_hash) {
      return NextResponse.json({ error: 'tx_hash required' }, { status: 400 });
    }

    const id = uuidv4();
    const amount = body.amount_mstc ?? body.amount_usdc ?? 0.01;

    await exec(
      'INSERT INTO transactions (id, job_id, agent_id, amount_usdc, tx_hash, demo, from_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, body.job_id || null, body.agent_id || 'agent-summarizer', amount, body.tx_hash, body.demo || 0, body.from_address || PLATFORM_ESCROW]
    );

    await flushNow();
    return NextResponse.json({ success: true, id, tx_hash: body.tx_hash });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
