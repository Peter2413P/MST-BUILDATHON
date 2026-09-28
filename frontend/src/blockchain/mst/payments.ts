import { ethers } from 'ethers';
import { PLATFORM_ESCROW_WALLET } from './config';
import type { RawEIP1193Provider, MSTPaymentRecord } from './types';
import { waitForConfirmation, getExplorerUrl } from './transactions';

/**
 * Estimate MSTC cost for an autonomous multi-agent task description.
 */
export function estimateJobCost(description: string): string {
  const words = description.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return '0.0100';
  const cost = Math.max(0.01, words * 0.0005);
  return cost.toFixed(4);
}

/**
 * Send a native $MSTC payment on MST Testnet to the platform escrow wallet.
 * Triggers wallet signature, waits for on-chain inclusion, and returns confirmed tx hash.
 */
export async function sendPayment(
  provider: RawEIP1193Provider,
  fromAddress: string,
  amountMstc: string,
  recipientAddress: string = PLATFORM_ESCROW_WALLET
): Promise<string> {
  if (!fromAddress) throw new Error('Wallet not connected');

  const valueWei = ethers.parseEther(amountMstc);
  const valueHex = '0x' + valueWei.toString(16);

  // Send native MSTC transfer transaction on MST Testnet
  const txHash = await provider.request<string>({
    method: 'eth_sendTransaction',
    params: [
      {
        from: fromAddress,
        to: recipientAddress,
        value: valueHex,
      },
    ],
  });

  if (!txHash) {
    throw new Error('No transaction hash returned from MST wallet');
  }

  console.log(`[MST Payment] Tx submitted: ${txHash} (${amountMstc} MSTC → ${recipientAddress})`);
  console.log(`[MST Payment] View on MSTScan: ${getExplorerUrl(txHash)}`);

  // Wait for real on-chain confirmation on MST Blockchain
  await waitForConfirmation(txHash);

  console.log(`[MST Payment] Tx confirmed on MST Blockchain: ${txHash}`);
  return txHash;
}

/**
 * Create a structured payment record.
 */
export function createPaymentRecord(
  jobId: string,
  payerAddress: string,
  amountMstc: string,
  txHash: string
): MSTPaymentRecord {
  return {
    jobId,
    payerAddress,
    recipientAddress: PLATFORM_ESCROW_WALLET,
    amountMstc,
    txHash,
    paymentState: 'PAYMENT_CONFIRMED',
    createdAt: new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
  };
}
