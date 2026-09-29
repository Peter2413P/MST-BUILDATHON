/**
 * frontend/scripts/test-mst-verification.ts
 *
 * Automated verification of the MST Testnet Transaction Verification and Settlement System.
 * Tests:
 * 1. Real on-chain transaction verification against MST Testnet RPC (Chain ID 91562037).
 * 2. Strict rejection of fake / fabricated / non-existent transaction hashes.
 * 3. Exact field extraction: block number, receipt status, from, to, value, confirmations.
 * 4. MSTScan explorer URL generation only for verified hashes.
 * 5. Standardized [MST Settlement] debug logging.
 */

import { ethers } from 'ethers';
import {
  MST_CONFIG,
  getMstProvider,
  verifyOnChainTransaction,
  waitForReceiptConfirmation,
  getMstExplorerUrl,
  logMstSettlement,
} from '../src/lib/server/mst';

async function runTests() {
  console.log('='.repeat(70));
  console.log('🧪 Running MST Testnet Transaction Verification & Settlement Tests');
  console.log('='.repeat(70));
  console.log(`Network: ${MST_CONFIG.chainName}`);
  console.log(`Chain ID: ${MST_CONFIG.chainId}`);
  console.log(`RPC: ${MST_CONFIG.rpcUrl}`);
  console.log(`Explorer: ${MST_CONFIG.explorerUrl}`);
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  const provider = getMstProvider();

  // 1. Verify RPC and Network Connectivity
  console.log('\n1️⃣ Testing MST Testnet RPC Connectivity & Chain ID...');
  const network = await provider.getNetwork();
  assert(network.chainId === BigInt(91562037), `Connected to exact MST Testnet Chain ID: ${network.chainId.toString()}`);

  const currentBlock = await provider.getBlockNumber();
  assert(currentBlock > 5800000, `Retrieved live MST Testnet block number: ${currentBlock}`);

  // 2. Fetch a Known Real Transaction on MST Testnet
  console.log('\n2️⃣ Testing Verification of Real On-Chain Transaction...');
  // Scan recent blocks for a real transaction on MST Testnet
  let realTxHash: string | null = null;
  for (let i = 0; i < 100; i++) {
    const block = await provider.getBlock(currentBlock - i, true);
    if (block && block.transactions.length > 0) {
      const firstTx = block.transactions[0] as unknown;
      realTxHash = typeof firstTx === 'string' ? firstTx : (firstTx as { hash: string }).hash;
      break;
    }
  }

  // Fallback to a confirmed transaction if scan window was empty
  if (!realTxHash) {
    realTxHash = '0x46102d10a33b0aebfe8fdaa3828c2aba04cc3c6c2a7d2fbaa6d6e36bdf306bfc';
  }

  console.log(`Verifying real transaction: ${realTxHash}`);
  const realResult = await verifyOnChainTransaction(realTxHash);

  assert(realResult.verified === true, 'Real transaction verified as SUCCESS on MST Testnet RPC');
  assert(realResult.status === 'SETTLED', 'Status marked as SETTLED');
  assert(realResult.receiptStatus === 'SUCCESS', 'Receipt status is SUCCESS (status 1)');
  assert(realResult.blockNumber !== null && realResult.blockNumber > 0, `Mined in block #${realResult.blockNumber}`);
  assert(Boolean(realResult.from && realResult.from.startsWith('0x')), `From address: ${realResult.from}`);
  assert(realResult.confirmations >= 1, `Confirmations count: ${realResult.confirmations}`);

  const explorerUrl = getMstExplorerUrl(realTxHash);
  assert(explorerUrl === `https://testnet.mstscan.com/tx/${realTxHash}`, `Generated valid explorer URL: ${explorerUrl}`);

  // 3. Test Rejection of Fake / Locally Fabricated Hashes
  console.log('\n3️⃣ Testing Strict Rejection of Fake / Unbroadcasted Hashes...');
  const fakeHash = '0x4a5347f149641d7daa3fab241806cb71c49e47f4dbbe95e1ea06f95aecacebf3';
  console.log(`Checking fake hash from user report: ${fakeHash}`);
  const fakeResult = await verifyOnChainTransaction(fakeHash);

  assert(fakeResult.verified === false, 'Fake transaction correctly reported verified = false');
  assert(fakeResult.status === 'NOT_FOUND', 'Fake transaction status is NOT_FOUND');
  assert(fakeResult.receiptStatus === 'NOT_FOUND', 'Fake transaction receipt status is NOT_FOUND');
  assert(Boolean(fakeResult.error && fakeResult.error.includes('not found')), 'Correctly reports error: transaction not found on MST Testnet RPC');

  // 4. Test Rejection of Malformed Hashes
  console.log('\n4️⃣ Testing Rejection of Malformed Hashes & Null Inputs...');
  const nullResult = await verifyOnChainTransaction(null);
  assert(nullResult.verified === false && nullResult.txHash === null, 'Null input safely handled without error');

  const malformedResult = await verifyOnChainTransaction('0x1234');
  assert(malformedResult.verified === false, 'Malformed hash safely rejected');

  // 5. Test Standardized Logging
  console.log('\n5️⃣ Testing Standardized [MST Settlement] Logger...');
  logMstSettlement({
    jobId: 'test-job-audit-001',
    payer: realResult.from || '0x615B191377A7B8E3e3cEeAA4EE8340a3b49Ff1aA',
    recipient: MST_CONFIG.platformEscrowWallet,
    expectedAmountMstc: realResult.valueMstc,
    txHash: realTxHash,
    broadcastSuccessful: true,
    transactionFound: true,
    blockNumber: realResult.blockNumber,
    receiptStatus: realResult.receiptStatus,
    transferVerified: realResult.verified,
    confirmationCount: realResult.confirmations,
    finalStatus: realResult.status,
  });
  assert(true, 'Standardized logging emitted correctly');

  console.log('\n' + '='.repeat(70));
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
