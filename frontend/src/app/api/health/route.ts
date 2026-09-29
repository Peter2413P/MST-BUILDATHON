import { NextResponse } from 'next/server';
import {
  ACTIVE_NETWORK,
  MST_SETTLEMENT_MODE,
  MST_ESCROW_CONTRACT_ADDRESS,
  PLATFORM_ESCROW_WALLET,
} from '@/blockchain/mst/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0',
    mstNetwork: 'testnet',
    chainId: ACTIVE_NETWORK.chainIdDecimal,
    rpcUrl: ACTIVE_NETWORK.rpcUrl,
    explorerUrl: ACTIVE_NETWORK.explorerUrl,
    escrowContract: MST_ESCROW_CONTRACT_ADDRESS || null,
    platformWallet: PLATFORM_ESCROW_WALLET,
    settlementMode: MST_SETTLEMENT_MODE,
    time: new Date().toISOString(),
  });
}
