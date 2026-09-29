import { NextRequest, NextResponse } from 'next/server';
import { generateNonce, getExpectedSignMessage } from '@/lib/server/auth';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { walletAddress?: string };
    const walletAddress = body.walletAddress?.trim();

    if (!walletAddress || !ethers.isAddress(walletAddress.toLowerCase())) {
      return NextResponse.json({ error: 'Valid walletAddress required' }, { status: 400 });
    }

    const nonce = await generateNonce(walletAddress);
    const message = getExpectedSignMessage(nonce);

    return NextResponse.json({
      nonce,
      message,
      walletAddress: ethers.getAddress(walletAddress.toLowerCase()),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
