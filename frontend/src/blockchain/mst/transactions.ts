import { ethers } from 'ethers';
import { ACTIVE_NETWORK } from './config';
import { mstRpcCall } from './client';
import type { MSTTransaction } from './types';

export interface RawTransactionReceipt {
  transactionHash: string;
  blockNumber: string;
  blockHash: string;
  status: string; // '0x1' for success, '0x0' for revert
  from: string;
  to: string;
  gasUsed: string;
}

export interface RawTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string | null;
}

/**
 * Return direct MSTScan explorer URL for a given transaction hash.
 */
export function getExplorerUrl(txHash: string): string {
  if (!txHash) return '';
  const cleanHash = txHash.trim();
  return `${ACTIVE_NETWORK.explorerUrl}/tx/${cleanHash}`;
}

/**
 * Return direct MSTScan explorer URL for an address.
 */
export function getAddressExplorerUrl(address: string): string {
  if (!address) return '';
  return `${ACTIVE_NETWORK.explorerUrl}/address/${address.trim()}`;
}

/**
 * Fetch a transaction receipt by hash on MST Blockchain.
 */
export async function getTransactionReceipt(txHash: string): Promise<RawTransactionReceipt | null> {
  return await mstRpcCall<RawTransactionReceipt | null>('eth_getTransactionReceipt', [txHash]);
}

/**
 * Fetch transaction details by hash on MST Blockchain.
 */
export async function getTransaction(txHash: string): Promise<MSTTransaction | null> {
  try {
    const raw = await mstRpcCall<RawTransaction | null>('eth_getTransactionByHash', [txHash]);
    if (!raw) return null;

    const receipt = await getTransactionReceipt(txHash);
    const valueMstc = ethers.formatEther(raw.value || '0x0');

    return {
      hash: raw.hash,
      from: raw.from,
      to: raw.to,
      valueMstc,
      blockNumber: raw.blockNumber ? parseInt(raw.blockNumber, 16) : undefined,
      status: receipt ? (receipt.status === '0x1' ? 'confirmed' : 'failed') : 'pending',
      timestamp: new Date().toISOString(),
      explorerUrl: getExplorerUrl(raw.hash),
    };
  } catch (err) {
    console.error(`[MST Transactions] Failed to fetch tx ${txHash}:`, err);
    return null;
  }
}

/**
 * Poll the MST Blockchain node until a transaction receipt is confirmed.
 */
export async function waitForConfirmation(
  txHash: string,
  maxWaitMs: number = 60000,
  intervalMs: number = 2000
): Promise<RawTransactionReceipt> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise(res => setTimeout(res, intervalMs));

    try {
      const receipt = await getTransactionReceipt(txHash);
      if (receipt !== null) {
        if (receipt.status !== '0x1') {
          throw new Error(`Transaction reverted on MST Blockchain (${txHash})`);
        }
        return receipt;
      }
    } catch (err) {
      if ((err as Error).message.includes('reverted')) {
        throw err;
      }
      // Transient network retry
    }
  }

  throw new Error(`Transaction not confirmed after ${maxWaitMs / 1000}s on MST Testnet. Check explorer: ${getExplorerUrl(txHash)}`);
}
