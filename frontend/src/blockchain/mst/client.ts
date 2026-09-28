import { ethers } from 'ethers';
import { ACTIVE_NETWORK } from './config';

/**
 * Perform a direct JSON-RPC call to the MST Blockchain node.
 */
export async function mstRpcCall<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(ACTIVE_NETWORK.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`MST RPC HTTP error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { result?: T; error?: { code: number; message: string } };

  if (data.error) {
    throw new Error(`MST RPC Error: ${data.error.message} (code: ${data.error.code})`);
  }

  return data.result as T;
}

/**
 * Get current block number on MST Blockchain.
 */
export async function getBlockNumber(): Promise<number> {
  const hex = await mstRpcCall<string>('eth_blockNumber');
  return parseInt(hex, 16);
}

/**
 * Get network chain ID from MST Blockchain node.
 */
export async function getChainId(): Promise<string> {
  return await mstRpcCall<string>('eth_chainId');
}

/**
 * Read the native $MSTC balance of any address on MST Blockchain.
 * Returns formatted string representation with 4 decimal places.
 */
export async function getBalance(address: string): Promise<string> {
  if (!address || !ethers.isAddress(address)) {
    return '0.0000';
  }

  try {
    const rawBalanceHex = await mstRpcCall<string>('eth_getBalance', [address, 'latest']);
    if (!rawBalanceHex || rawBalanceHex === '0x') return '0.0000';

    const formatted = ethers.formatEther(rawBalanceHex);
    const num = parseFloat(formatted);
    return isNaN(num) ? '0.0000' : num.toFixed(4);
  } catch (err) {
    console.warn('[MST Client] Failed to fetch balance:', err);
    return '0.0000';
  }
}
