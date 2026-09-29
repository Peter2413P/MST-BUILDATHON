import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/server/auth';
import { query } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

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

    // Find all unique agents utilized in tasks by this user
    const hiredAgents = await query(
      `SELECT 
        a.id, a.name, a.skill, a.description, a.price_usdc, a.avg_quality, a.wallet_address,
        COUNT(st.id) as user_executions,
        SUM(st.tokens_used) as total_tokens,
        SUM(st.payment_usdc) as total_spent
       FROM subtasks st
       JOIN jobs j ON j.id = st.job_id
       JOIN agents a ON a.id = st.agent_id
       WHERE LOWER(COALESCE(j.payer_address, '')) = ?
       GROUP BY a.id
       ORDER BY user_executions DESC`,
      [wallet]
    );

    return NextResponse.json(hiredAgents);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
