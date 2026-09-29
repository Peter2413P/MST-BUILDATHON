import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const bearerId = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const cookieId = req.cookies.get('agentmesh_session_id')?.value;
    const queryId = req.nextUrl.searchParams.get('sessionId');

    const sessionId = bearerId || cookieId || queryId;
    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        autoPaymentEnabled: false,
        sessionLimit: 0,
        sessionSpent: 0,
        remaining: 0,
      });
    }

    return NextResponse.json({
      authenticated: true,
      walletAddress: session.walletAddress,
      autoPaymentEnabled: session.autoPaymentEnabled,
      sessionLimit: session.sessionLimit,
      sessionSpent: session.sessionSpent,
      remaining: session.remaining,
      connectedNetwork: session.connectedNetwork,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
