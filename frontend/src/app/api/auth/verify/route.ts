import { NextRequest, NextResponse } from 'next/server';
import { verifySignature, createSession } from '@/lib/server/auth';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { walletAddress?: string; signature?: string };
    const { walletAddress, signature } = body;

    if (!walletAddress || !signature || !ethers.isAddress(walletAddress.toLowerCase())) {
      return NextResponse.json({ error: 'walletAddress and cryptographic signature required' }, { status: 400 });
    }

    const verification = await verifySignature(walletAddress, signature);
    if (!verification.success) {
      return NextResponse.json({ error: verification.error || 'Authentication failed' }, { status: 401 });
    }

    const session = await createSession(walletAddress);

    const response = NextResponse.json({
      authenticated: true,
      sessionId: session.sessionId,
      walletAddress: session.walletAddress,
      connectedNetwork: session.connectedNetwork,
      sessionCreatedAt: session.sessionCreatedAt,
    });

    // Set non-persistent session cookie (cleared on browser close)
    response.cookies.set('agentmesh_session_id', session.sessionId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
