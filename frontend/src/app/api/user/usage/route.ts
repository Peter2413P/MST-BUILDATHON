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

    // Compute aggregate usage statistics
    const statsRows = await query(
      `SELECT 
        COUNT(DISTINCT j.id) as total_jobs,
        COUNT(st.id) as total_subtasks,
        COALESCE(SUM(st.tokens_used), 0) as total_tokens,
        COALESCE(SUM(t.amount_usdc), 0) as total_spent_mstc
       FROM jobs j
       LEFT JOIN subtasks st ON st.job_id = j.id
       LEFT JOIN transactions t ON t.job_id = j.id
       WHERE LOWER(COALESCE(j.payer_address, '')) = ?`,
      [wallet]
    ) as { total_jobs: number; total_subtasks: number; total_tokens: number; total_spent_mstc: number }[];

    const usage = statsRows[0] || { total_jobs: 0, total_subtasks: 0, total_tokens: 0, total_spent_mstc: 0 };

    return NextResponse.json({
      walletAddress: session.walletAddress,
      totalTasks: usage.total_jobs,
      totalSubtasksExecuted: usage.total_subtasks,
      totalTokensProcessed: usage.total_tokens,
      totalMstcSettled: parseFloat(usage.total_spent_mstc.toFixed(6)),
      sessionAllowance: {
        enabled: session.autoPaymentEnabled,
        limit: session.sessionLimit,
        spent: session.sessionSpent,
        remaining: session.remaining,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
