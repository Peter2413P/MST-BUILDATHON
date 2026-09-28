import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';

const MST_RPC = process.env.NEXT_PUBLIC_MST_RPC_URL || 'https://testnetrpc.mstblockchain.com';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address || !ethers.isAddress(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  try {
    const rpcRes = await fetch(MST_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
      cache: 'no-store',
    });

    const rpcData = (await rpcRes.json()) as { result?: string; error?: unknown };
    if (rpcData.error || !rpcData.result || rpcData.result === '0x') {
      return NextResponse.json({
        balance: '0.0000',
        mstc: '0.0000',
        usdc: '0.0000',
        currency: 'MSTC',
        address,
        network: 'mst-testnet',
      });
    }

    const formatted = ethers.formatEther(rpcData.result);
    const num = parseFloat(formatted);
    const balance = isNaN(num) ? '0.0000' : num.toFixed(4);

    return NextResponse.json({
      balance,
      mstc: balance,
      usdc: balance,
      currency: 'MSTC',
      address,
      network: 'mst-testnet',
    });
  } catch {
    return NextResponse.json({
      balance: '0.0000',
      mstc: '0.0000',
      usdc: '0.0000',
      currency: 'MSTC',
      address,
      network: 'mst-testnet',
    });
  }
}
