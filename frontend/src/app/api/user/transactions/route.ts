import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/server/auth';
import { query } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

const PLATFORM_ESCROW = '0x6001712aE72d24Babc386866d035b6d55331E634';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const bearerId = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const cookieId = req.cookies.get('agentmesh_session_id')?.value;
    const sessionId = bearerId || cookieId || req.nextUrl.searchParams.get('sessionId');

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wallet = session.walletAddress.toLowerCase();
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50') || 50, 100);

    const BASE_SQL = `SELECT 
      t.id, t.job_id, t.agent_id, t.amount_usdc, t.amount_usdc as amount_mstc, 'MSTC' as currency,
      t.tx_hash, t.demo, t.created_at,
      COALESCE(a.name, t.agent_id) as agent_name,
      COALESCE(a.skill, 'general') as agent_skill,
      COALESCE(a.wallet_address, '${PLATFORM_ESCROW}') as to_address,
      COALESCE(t.from_address, j.payer_address, '${PLATFORM_ESCROW}') as from_address,
      j.description as job_description,
      CASE WHEN t.amount_usdc <= 0.01 AND t.agent_id = 'agent-summarizer' THEN 'query_anchor' ELSE 'payout' END as type
    FROM transactions t 
    LEFT JOIN agents a ON a.id = t.agent_id 
    LEFT JOIN jobs j ON j.id = t.job_id
    WHERE LOWER(COALESCE(t.from_address, j.payer_address, '')) = ? OR LOWER(COALESCE(a.wallet_address, '')) = ?
    ORDER BY t.created_at DESC LIMIT ?`;

    const txs = await query(BASE_SQL, [wallet, wallet, limit]);
    return NextResponse.json(txs);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
