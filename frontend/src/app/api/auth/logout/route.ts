import { NextRequest, NextResponse } from 'next/server';
import { invalidateSession, invalidateWalletSessions } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const bearerId = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const cookieId = req.cookies.get('agentmesh_session_id')?.value;
    
    let body: { sessionId?: string; walletAddress?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Body optional
    }

    const sessionId = body.sessionId || bearerId || cookieId;
    if (sessionId) {
      invalidateSession(sessionId);
    }
    if (body.walletAddress) {
      invalidateWalletSessions(body.walletAddress);
    }

    const res = NextResponse.json({ success: true, loggedOut: true });
    res.cookies.delete('agentmesh_session_id');
    return res;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
