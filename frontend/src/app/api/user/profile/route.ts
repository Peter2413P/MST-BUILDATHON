import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/server/auth';
import { getBalance } from '@/blockchain/mst';
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
      return NextResponse.json({ error: 'Unauthorized: Active session required' }, { status: 401 });
    }

    const walletAddress = session.walletAddress;
    const onChainBalance = await getBalance(walletAddress);

    // Aggregate user stats from database
    const jobsCountRows = await query(
      'SELECT COUNT(*) as total_jobs, SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed_jobs, SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed_jobs FROM jobs WHERE LOWER(COALESCE(payer_address, "")) = ?',
      [walletAddress.toLowerCase()]
    ) as { total_jobs: number; completed_jobs: number; failed_jobs: number }[];

    const spendRows = await query(
      'SELECT SUM(amount_usdc) as total_spent FROM transactions WHERE LOWER(COALESCE(from_address, "")) = ?',
      [walletAddress.toLowerCase()]
    ) as { total_spent: number | null }[];

    const stats = jobsCountRows[0] || { total_jobs: 0, completed_jobs: 0, failed_jobs: 0 };
    const totalSpentMstc = spendRows[0]?.total_spent || 0;

    return NextResponse.json({
      walletAddress,
      authenticated: true,
      connectedNetwork: session.connectedNetwork,
      sessionCreatedAt: session.sessionCreatedAt,
      onChainBalanceMstc: onChainBalance,
      totalTasks: stats.total_jobs,
      completedTasks: stats.completed_jobs,
      failedTasks: stats.failed_jobs,
      totalSpentMstc: parseFloat(totalSpentMstc.toFixed(6)),
      sessionBudget: {
        autoPaymentEnabled: session.autoPaymentEnabled,
        sessionLimit: session.sessionLimit,
        sessionSpent: session.sessionSpent,
        remaining: session.remaining,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
