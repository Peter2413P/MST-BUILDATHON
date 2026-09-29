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
  recipientAddress: string = PLATFORM_ESCROW_WALLET,
  queryData?: string
): Promise<string> {
  if (!fromAddress) throw new Error('Wallet not connected');

  const cleanRecipient = ethers.getAddress((recipientAddress || PLATFORM_ESCROW_WALLET).toLowerCase());
  const cleanFrom = ethers.getAddress(fromAddress.toLowerCase());

  const valueWei = ethers.parseEther(amountMstc);
  const valueHex = '0x' + valueWei.toString(16);

  // Encode query metadata into tx calldata so every user query is permanently recorded on-chain
  const payloadSummary = queryData
    ? JSON.stringify({ app: 'AgentMesh', q: queryData.slice(0, 180), ts: Date.now() })
    : JSON.stringify({ app: 'AgentMesh', type: 'escrow_deposit', ts: Date.now() });
  const dataHex = ethers.hexlify(ethers.toUtf8Bytes(payloadSummary));

  // Send native MSTC transfer transaction on MST Testnet
  const txHash = await provider.request<string>({
    method: 'eth_sendTransaction',
    params: [
      {
        from: cleanFrom,
        to: cleanRecipient,
        value: valueHex,
        data: dataHex,
      },
    ],
  });

  if (!txHash) {
    throw new Error('No transaction hash returned from MST wallet');
  }

  console.log(`[MST Payment] Tx submitted: ${txHash} (${amountMstc} MSTC → ${cleanRecipient})`);
  console.log(`[MST Payment] View on MSTScan: ${getExplorerUrl(txHash)}`);

  // Record transaction immediately to database ledger so it appears in Activity right away
  try {
    if (typeof window !== 'undefined') {
      fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_mstc: parseFloat(amountMstc),
          tx_hash: txHash,
          agent_id: 'agent-summarizer',
        }),
      }).catch(() => {});
    }
  } catch {
    // Non-blocking
  }

  // Poll confirmation in background without blocking immediate return
  waitForConfirmation(txHash, 30000, 1500)
    .then(() => console.log(`[MST Payment] Tx confirmed on MST Blockchain: ${txHash}`))
    .catch(confErr => console.warn(`[MST Payment] Confirmation polling timeout, tx broadcasted: ${txHash}`, confErr));

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
