import { NextRequest, NextResponse } from 'next/server';
import { authorizeSessionPayment } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const bearerId = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const cookieId = req.cookies.get('agentmesh_session_id')?.value;

    const body = await req.json() as { sessionId?: string; maxSpendMstc?: number };
    const sessionId = body.sessionId || bearerId || cookieId;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required. Please authenticate first.' }, { status: 401 });
    }

    const maxSpend = typeof body.maxSpendMstc === 'number' ? body.maxSpendMstc : 1.0;
    const result = await authorizeSessionPayment(sessionId, maxSpend);

    if (!result.success || !result.session) {
      return NextResponse.json({ error: result.error || 'Failed to authorize session payment' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      authorized: true,
      walletAddress: result.session.walletAddress,
      sessionLimit: result.session.sessionLimit,
      sessionSpent: result.session.sessionSpent,
      remaining: result.session.remaining,
      message: `Automatic task payments authorized for up to ${result.session.sessionLimit} MSTC for this page session.`,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
