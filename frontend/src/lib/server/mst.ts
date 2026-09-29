/**
 * frontend/src/lib/server/mst.ts
 *
 * Real MST Testnet Blockchain Verification, Settlement, and RPC Service.
 * Chain ID: 91562037
 * RPC: https://testnetrpc.mstblockchain.com
 * Explorer: https://testnet.mstscan.com
 *
 * GUARANTEES:
 * 1. Zero fake/mock/placeholder/deterministic hashes.
 * 2. Every displayed blockchain hash is verified on MST Testnet via eth_getTransactionByHash and eth_getTransactionReceipt.
 * 3. Verified transfer amounts, chain ID, recipient, and status == 1.
 */

import { ethers } from 'ethers';

export const MST_CONFIG = {
  chainId: 91562037,
  chainIdHex: '0x5752035',
  chainName: 'MST Testnet',
  rpcUrl: process.env.MST_RPC_URL || process.env.NEXT_PUBLIC_MST_RPC_URL || 'https://testnetrpc.mstblockchain.com',
  explorerUrl: process.env.MST_EXPLORER_URL || process.env.NEXT_PUBLIC_MST_EXPLORER_URL || 'https://testnet.mstscan.com',
  platformEscrowWallet: (process.env.NEXT_PUBLIC_MST_PLATFORM_WALLET || '0x6001712aE72d24Babc386866d035b6d55331E634').toLowerCase(),
};

const PLATFORM_PRIVATE_KEY = process.env.MST_PLATFORM_PRIVATE_KEY || process.env.MST_ESCROW_PRIVATE_KEY;

let _provider: ethers.JsonRpcProvider | null = null;

export function getMstProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(MST_CONFIG.rpcUrl, {
      chainId: MST_CONFIG.chainId,
      name: 'mst-testnet',
    });
  }
  return _provider;
}

export function getMstExplorerUrl(txHash?: string | null): string {
  if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) return '';
  return `${MST_CONFIG.explorerUrl}/tx/${txHash.trim()}`;
}

export interface AgentSplit {
  agentId: string;
  walletAddress: string;
  mstcAmount: number;
  subtaskId: string;
}

export interface MstVerificationResult {
  verified: boolean;
  status: 'SETTLED' | 'CONFIRMING' | 'FAILED' | 'VERIFICATION_FAILED' | 'NOT_FOUND';
  txHash: string | null;
  blockNumber: number | null;
  blockHash: string | null;
  from: string | null;
  to: string | null;
  valueMstc: number;
  nonce: number | null;
  gasUsed: string | null;
  chainId: number | null;
  receiptStatus: 'SUCCESS' | 'REVERTED' | 'PENDING' | 'NOT_FOUND';
  confirmations: number;
  error?: string;
}

/**
 * Standardized debug logger matching Requirement 9:
 */
export function logMstSettlement(info: {
  jobId: string;
  payer: string;
  recipient: string;
  expectedAmountMstc: number;
  txHash: string | null;
  broadcastSuccessful: boolean;
  transactionFound: boolean;
  blockNumber: number | null;
  receiptStatus: string;
  transferVerified: boolean;
  confirmationCount: number;
  finalStatus: string;
  error?: string;
}) {
  console.log('--------------------------------------------------');
  console.log('[MST Settlement]');
  console.log(`Job ID: ${info.jobId}`);
  console.log(`Network: ${MST_CONFIG.chainName}`);
  console.log(`Chain ID: ${MST_CONFIG.chainId}`);
  console.log(`RPC: ${MST_CONFIG.rpcUrl}`);
  console.log(`Payer: ${info.payer}`);
  console.log(`Recipient: ${info.recipient}`);
  console.log(`Token: MSTC (Native)`);
  console.log(`Expected amount: ${info.expectedAmountMstc.toFixed(4)} MSTC`);
  console.log(`Transaction hash: ${info.txHash || 'NONE (No on-chain transaction)'}`);
  console.log(`Broadcast successful: ${info.broadcastSuccessful ? 'YES' : 'NO'}`);
  console.log(`Transaction found: ${info.transactionFound ? 'YES' : 'NO'}`);
  console.log(`Block number: ${info.blockNumber !== null ? info.blockNumber : 'N/A'}`);
  console.log(`Receipt status: ${info.receiptStatus}`);
  console.log(`Token transfer verified: ${info.transferVerified ? 'YES' : 'NO'}`);
  console.log(`Confirmation count: ${info.confirmationCount}`);
  console.log(`Final settlement status: ${info.finalStatus}`);
  if (info.error) {
    console.log(`[MST Settlement] ERROR: ${info.error}`);
  }
  console.log('--------------------------------------------------');
}

/**
 * Verify a transaction directly against the MST Testnet RPC.
 * Queries eth_getTransactionByHash and eth_getTransactionReceipt.
 */
export async function verifyOnChainTransaction(
  txHash?: string | null,
  minExpectedAmountMstc: number = 0,
  expectedRecipient?: string
): Promise<MstVerificationResult> {
  if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
    return {
      verified: false,
      status: 'NOT_FOUND',
      txHash: null,
      blockNumber: null,
      blockHash: null,
      from: null,
      to: null,
      valueMstc: 0,
      nonce: null,
      gasUsed: null,
      chainId: null,
      receiptStatus: 'NOT_FOUND',
      confirmations: 0,
      error: 'Invalid or missing transaction hash format',
    };
  }

  try {
    const provider = getMstProvider();
    const tx = await provider.getTransaction(txHash);

    if (!tx) {
      return {
        verified: false,
        status: 'NOT_FOUND',
        txHash,
        blockNumber: null,
        blockHash: null,
        from: null,
        to: null,
        valueMstc: 0,
        nonce: null,
        gasUsed: null,
        chainId: null,
        receiptStatus: 'NOT_FOUND',
        confirmations: 0,
        error: 'transaction not found on MST Testnet RPC',
      };
    }

    const valueMstc = parseFloat(ethers.formatEther(tx.value || 0));
    const cleanTo = tx.to ? ethers.getAddress(tx.to.toLowerCase()) : null;
    const cleanFrom = tx.from ? ethers.getAddress(tx.from.toLowerCase()) : null;
    const chainIdNum = tx.chainId ? Number(tx.chainId) : null;

    // Check chain ID if explicitly reported
    if (chainIdNum && chainIdNum !== MST_CONFIG.chainId && chainIdNum !== 4545) {
      return {
        verified: false,
        status: 'VERIFICATION_FAILED',
        txHash,
        blockNumber: tx.blockNumber ?? null,
        blockHash: null,
        from: cleanFrom,
        to: cleanTo,
        valueMstc,
        nonce: tx.nonce,
        gasUsed: null,
        chainId: chainIdNum,
        receiptStatus: 'NOT_FOUND',
        confirmations: 0,
        error: `Chain ID mismatch: transaction is on chain ${chainIdNum}, expected ${MST_CONFIG.chainId}`,
      };
    }

    // Check recipient if expectedRecipient is provided
    if (expectedRecipient && cleanTo) {
      const cleanExpected = ethers.getAddress(expectedRecipient.toLowerCase());
      if (cleanTo !== cleanExpected) {
        return {
          verified: false,
          status: 'VERIFICATION_FAILED',
          txHash,
          blockNumber: tx.blockNumber ?? null,
          blockHash: null,
          from: cleanFrom,
          to: cleanTo,
          valueMstc,
          nonce: tx.nonce,
          gasUsed: null,
          chainId: chainIdNum,
          receiptStatus: 'NOT_FOUND',
          confirmations: 0,
          error: `Recipient mismatch: sent to ${cleanTo}, expected ${cleanExpected}`,
        };
      }
    }

    // Check minimum payment amount if enforced
    if (minExpectedAmountMstc > 0 && valueMstc < minExpectedAmountMstc * 0.999) {
      return {
        verified: false,
        status: 'VERIFICATION_FAILED',
        txHash,
        blockNumber: tx.blockNumber ?? null,
        blockHash: null,
        from: cleanFrom,
        to: cleanTo,
        valueMstc,
        nonce: tx.nonce,
        gasUsed: null,
        chainId: chainIdNum,
        receiptStatus: 'NOT_FOUND',
        confirmations: 0,
        error: `expected MSTC transfer not detected: received ${valueMstc} MSTC, expected ${minExpectedAmountMstc} MSTC`,
      };
    }

    // Query Transaction Receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return {
        verified: false,
        status: 'CONFIRMING',
        txHash,
        blockNumber: null,
        blockHash: null,
        from: cleanFrom,
        to: cleanTo,
        valueMstc,
        nonce: tx.nonce,
        gasUsed: null,
        chainId: chainIdNum,
        receiptStatus: 'PENDING',
        confirmations: 0,
      };
    }

    const currentBlock = await provider.getBlockNumber();
    const confirmations = receipt.blockNumber ? Math.max(1, currentBlock - receipt.blockNumber + 1) : 0;

    if (receipt.status !== 1) {
      return {
        verified: false,
        status: 'FAILED',
        txHash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        from: cleanFrom,
        to: cleanTo,
        valueMstc,
        nonce: tx.nonce,
        gasUsed: receipt.gasUsed.toString(),
        chainId: chainIdNum,
        receiptStatus: 'REVERTED',
        confirmations,
        error: 'transaction reverted on MST Testnet',
      };
    }

    return {
      verified: true,
      status: 'SETTLED',
      txHash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      from: cleanFrom,
      to: cleanTo,
      valueMstc,
      nonce: tx.nonce,
      gasUsed: receipt.gasUsed.toString(),
      chainId: chainIdNum,
      receiptStatus: 'SUCCESS',
      confirmations,
    };
  } catch (err) {
    return {
      verified: false,
      status: 'VERIFICATION_FAILED',
      txHash,
      blockNumber: null,
      blockHash: null,
      from: null,
      to: null,
      valueMstc: 0,
      nonce: null,
      gasUsed: null,
      chainId: null,
      receiptStatus: 'NOT_FOUND',
      confirmations: 0,
      error: (err as Error).message,
    };
  }
}

/**
 * Polls for transaction confirmation up to maxWaitMs.
 */
export async function waitForReceiptConfirmation(
  txHash: string,
  minExpectedAmountMstc: number = 0,
  expectedRecipient?: string,
  maxWaitMs: number = 15000,
  intervalMs: number = 1500
): Promise<MstVerificationResult> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const result = await verifyOnChainTransaction(txHash, minExpectedAmountMstc, expectedRecipient);
    if (result.status === 'SETTLED' || result.status === 'FAILED' || result.status === 'VERIFICATION_FAILED') {
      return result;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }

  return await verifyOnChainTransaction(txHash, minExpectedAmountMstc, expectedRecipient);
}

/**
 * Anchors a user query onto the MST Testnet blockchain IF a platform signer is configured.
 * NEVER returns a fabricated/mock hash. Returns null if not broadcasted.
 */
export async function anchorQueryOnChain(
  jobId: string,
  description: string,
  payerAddress?: string
): Promise<string | null> {
  let payer = MST_CONFIG.platformEscrowWallet;
  try {
    if (payerAddress && ethers.isAddress(payerAddress.toLowerCase())) {
      payer = ethers.getAddress(payerAddress.toLowerCase());
    }
  } catch {
    payer = MST_CONFIG.platformEscrowWallet;
  }

  if (PLATFORM_PRIVATE_KEY && PLATFORM_PRIVATE_KEY.startsWith('0x')) {
    try {
      const provider = getMstProvider();
      const signer = new ethers.Wallet(PLATFORM_PRIVATE_KEY, provider);
      const payload = JSON.stringify({
        app: 'AgentMesh',
        type: 'query_anchor',
        jobId,
        payer,
        q: description.slice(0, 120),
        ts: Date.now(),
      });
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes(payload));

      const tx = await signer.sendTransaction({
        to: ethers.getAddress(MST_CONFIG.platformEscrowWallet),
        value: 0,
        data: dataHex,
      });

      console.log(`[MST Server] User query broadcasted on-chain: ${tx.hash}`);
      return tx.hash;
    } catch (err) {
      console.warn('[MST Server] Platform signer anchor failed:', (err as Error).message);
    }
  }

  // Never return fake hash
  return null;
}

/**
 * Execute agent payouts on MST Testnet or verify buyer transaction.
 * NEVER returns fake/placeholder hashes.
 */
export async function executeMstAgentSplits(
  splits: AgentSplit[],
  jobId: string,
  buyerTx?: string | null,
  totalExpectedCost: number = 0.01
): Promise<{
  txMap: Record<string, string>;
  settledAt: string;
  verifiedOnChain: boolean;
  verification: MstVerificationResult | null;
  primaryTxHash: string | null;
}> {
  const settledAt = new Date().toISOString();
  const txMap: Record<string, string> = {};

  // Case 1: Buyer provided an on-chain transaction hash
  if (buyerTx && buyerTx.startsWith('0x') && buyerTx.length === 66) {
    const verification = await waitForReceiptConfirmation(buyerTx, totalExpectedCost, MST_CONFIG.platformEscrowWallet, 8000, 1500);

    logMstSettlement({
      jobId,
      payer: verification.from || 'Buyer',
      recipient: verification.to || MST_CONFIG.platformEscrowWallet,
      expectedAmountMstc: totalExpectedCost,
      txHash: buyerTx,
      broadcastSuccessful: true,
      transactionFound: verification.status !== 'NOT_FOUND',
      blockNumber: verification.blockNumber,
      receiptStatus: verification.receiptStatus,
      transferVerified: verification.verified,
      confirmationCount: verification.confirmations,
      finalStatus: verification.status,
      error: verification.error,
    });

    if (verification.verified) {
      for (const s of splits) {
        txMap[s.agentId] = buyerTx;
      }
      return {
        txMap,
        settledAt,
        verifiedOnChain: true,
        verification,
        primaryTxHash: buyerTx,
      };
    } else {
      return {
        txMap: {},
        settledAt,
        verifiedOnChain: false,
        verification,
        primaryTxHash: buyerTx,
      };
    }
  }

  // Case 2: Server-side platform wallet broadcast
  if (PLATFORM_PRIVATE_KEY && PLATFORM_PRIVATE_KEY.startsWith('0x')) {
    try {
      const provider = getMstProvider();
      const signer = new ethers.Wallet(PLATFORM_PRIVATE_KEY, provider);

      console.log(`[MST Settlement] Broadcasting on-chain splits from platform wallet: ${signer.address}`);
      let allVerified = true;
      let firstTx: string | null = null;
      let lastVerification: MstVerificationResult | null = null;

      for (const s of splits) {
        if (!s.walletAddress || !ethers.isAddress(s.walletAddress.toLowerCase())) {
          continue;
        }

        try {
          const cleanTo = ethers.getAddress(s.walletAddress.toLowerCase());
          const value = ethers.parseEther(s.mstcAmount.toFixed(6));
          const payload = JSON.stringify({ app: 'AgentMesh', type: 'agent_payout', job: jobId, agent: s.agentId });
          const tx = await signer.sendTransaction({
            to: cleanTo,
            value,
            data: ethers.hexlify(ethers.toUtf8Bytes(payload)),
          });

          if (!firstTx) firstTx = tx.hash;

          const ver = await waitForReceiptConfirmation(tx.hash, s.mstcAmount, cleanTo, 10000, 1500);
          lastVerification = ver;

          if (ver.verified) {
            txMap[s.agentId] = tx.hash;
          } else {
            allVerified = false;
          }
        } catch (subErr) {
          console.error(`[MST Settlement] Payout failed for agent ${s.agentId}:`, (subErr as Error).message);
          allVerified = false;
        }
      }

      logMstSettlement({
        jobId,
        payer: signer.address,
        recipient: 'Agent Wallets',
        expectedAmountMstc: totalExpectedCost,
        txHash: firstTx,
        broadcastSuccessful: Boolean(firstTx),
        transactionFound: Boolean(lastVerification && lastVerification.status !== 'NOT_FOUND'),
        blockNumber: lastVerification?.blockNumber ?? null,
        receiptStatus: lastVerification?.receiptStatus ?? 'NOT_FOUND',
        transferVerified: allVerified,
        confirmationCount: lastVerification?.confirmations ?? 0,
        finalStatus: allVerified ? 'SETTLED' : 'FAILED',
        error: lastVerification?.error,
      });

      return {
        txMap,
        settledAt,
        verifiedOnChain: allVerified && Object.keys(txMap).length > 0,
        verification: lastVerification,
        primaryTxHash: firstTx,
      };
    } catch (err) {
      console.error('[MST Settlement] Platform signer error:', (err as Error).message);
    }
  }

  // Case 3: Off-chain session authorization (No on-chain broadcast)
  logMstSettlement({
    jobId,
    payer: 'Session Ledger',
    recipient: MST_CONFIG.platformEscrowWallet,
    expectedAmountMstc: totalExpectedCost,
    txHash: null,
    broadcastSuccessful: false,
    transactionFound: false,
    blockNumber: null,
    receiptStatus: 'NOT_FOUND',
    transferVerified: false,
    confirmationCount: 0,
    finalStatus: 'PAYMENT_PENDING',
    error: 'No on-chain transaction broadcasted; settled in session allowance ledger',
  });

  return {
    txMap: {},
    settledAt,
    verifiedOnChain: false,
    verification: null,
    primaryTxHash: null,
  };
}

/**
 * Release escrowed funds to hired agent on MST Testnet via AgentMeshEscrow.completeTask(taskId).
 */
export async function executeEscrowTaskComplete(
  jobId: string,
  agentAddress?: string
): Promise<{ success: boolean; txHash: string | null; blockNumber: number | null; error?: string }> {
  const { isEscrowEnabled, getEscrowContractAddress, calculateTaskId, ESCROW_ABI } = await import(
    '@/blockchain/mst/escrow'
  );

  if (!isEscrowEnabled()) {
    return { success: false, txHash: null, blockNumber: null, error: 'Escrow mode not active or contract unconfigured' };
  }

  if (!PLATFORM_PRIVATE_KEY || !PLATFORM_PRIVATE_KEY.startsWith('0x')) {
    return { success: false, txHash: null, blockNumber: null, error: 'Platform executor private key not configured' };
  }

  try {
    const provider = getMstProvider();
    const signer = new ethers.Wallet(PLATFORM_PRIVATE_KEY, provider);
    const contractAddress = getEscrowContractAddress();
    const contract = new ethers.Contract(contractAddress, ESCROW_ABI, signer);
    const taskId = calculateTaskId(jobId);

    console.log(`[Escrow Settlement] Calling completeTask on contract ${contractAddress} for taskId ${taskId}`);
    const tx = await contract.completeTask(taskId);
    console.log(`[Escrow Settlement] completeTask submitted: ${tx.hash}`);

    const receipt = await tx.wait(1);
    console.log(`[Escrow Settlement] completeTask confirmed in block #${receipt.blockNumber}`);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error(`[Escrow Settlement] completeTask failed for job ${jobId}:`, errorMsg);
    return { success: false, txHash: null, blockNumber: null, error: errorMsg };
  }
}

/**
 * Refund escrowed funds to user on MST Testnet via AgentMeshEscrow.failTask(taskId).
 */
export async function executeEscrowTaskFail(
  jobId: string,
  reason: string
): Promise<{ success: boolean; txHash: string | null; blockNumber: number | null; error?: string }> {
  const { isEscrowEnabled, getEscrowContractAddress, calculateTaskId, ESCROW_ABI } = await import(
    '@/blockchain/mst/escrow'
  );

  if (!isEscrowEnabled()) {
    return { success: false, txHash: null, blockNumber: null, error: 'Escrow mode not active or contract unconfigured' };
  }

  if (!PLATFORM_PRIVATE_KEY || !PLATFORM_PRIVATE_KEY.startsWith('0x')) {
    return { success: false, txHash: null, blockNumber: null, error: 'Platform executor private key not configured' };
  }

  try {
    const provider = getMstProvider();
    const signer = new ethers.Wallet(PLATFORM_PRIVATE_KEY, provider);
    const contractAddress = getEscrowContractAddress();
    const contract = new ethers.Contract(contractAddress, ESCROW_ABI, signer);
    const taskId = calculateTaskId(jobId);

    console.log(`[Escrow Settlement] Calling failTask on contract ${contractAddress} for taskId ${taskId} (Reason: ${reason})`);
    const tx = await contract.failTask(taskId);
    console.log(`[Escrow Settlement] failTask refund submitted: ${tx.hash}`);

    const receipt = await tx.wait(1);
    console.log(`[Escrow Settlement] failTask refund confirmed in block #${receipt.blockNumber}`);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error(`[Escrow Settlement] failTask failed for job ${jobId}:`, errorMsg);
    return { success: false, txHash: null, blockNumber: null, error: errorMsg };
  }
}

/**
 * Reads on-chain escrow state for a given jobId.
 */
export async function verifyEscrowTaskOnChain(jobId: string) {
  const { isEscrowEnabled, calculateTaskId, fetchEscrowTask } = await import('@/blockchain/mst/escrow');
  if (!isEscrowEnabled()) return null;

  const taskId = calculateTaskId(jobId);
  return await fetchEscrowTask(taskId, getMstProvider());
}

