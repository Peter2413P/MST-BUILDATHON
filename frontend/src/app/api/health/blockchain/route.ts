import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { ACTIVE_NETWORK, MST_ESCROW_CONTRACT_ADDRESS } from '@/blockchain/mst/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider(ACTIVE_NETWORK.rpcUrl, {
      chainId: ACTIVE_NETWORK.chainIdDecimal,
      name: 'mst-testnet',
    });

    const [blockNumber, network] = await Promise.all([
      provider.getBlockNumber(),
      provider.getNetwork(),
    ]);

    let contractVerified = false;
    let bytecodeLength = 0;

    if (MST_ESCROW_CONTRACT_ADDRESS && ethers.isAddress(MST_ESCROW_CONTRACT_ADDRESS)) {
      const code = await provider.getCode(MST_ESCROW_CONTRACT_ADDRESS);
      bytecodeLength = (code.length - 2) / 2;
      contractVerified = code !== '0x' && code.length > 2;
    }

    return NextResponse.json({
      status: 'ok',
      network: 'MST Testnet',
      chainId: Number(network.chainId),
      latestBlock: blockNumber,
      rpcUrl: ACTIVE_NETWORK.rpcUrl,
      escrowContract: MST_ESCROW_CONTRACT_ADDRESS || null,
      contractVerified,
      bytecodeBytes: bytecodeLength,
      explorerUrl: `${ACTIVE_NETWORK.explorerUrl}/address/${MST_ESCROW_CONTRACT_ADDRESS}`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        error: (err as Error).message,
        rpcUrl: ACTIVE_NETWORK.rpcUrl,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
