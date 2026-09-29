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
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50') || 50, 100);

    const jobs = await query(
      `SELECT * FROM jobs 
       WHERE LOWER(COALESCE(payer_address, '')) = ? 
       ORDER BY submitted_at DESC LIMIT ?`,
      [wallet, limit]
    );

    return NextResponse.json(jobs);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
