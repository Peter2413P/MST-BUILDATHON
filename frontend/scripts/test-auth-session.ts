import { ethers } from 'ethers';
import {
  generateNonce,
  getExpectedSignMessage,
  verifySignature,
  createSession,
  getSession,
  authorizeSessionPayment,
  checkSessionAllowance,
  deductSessionSpend,
  invalidateWalletSessions,
} from '../src/lib/server/auth';

async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 RUNNING AGENTMESH AUTHENTICATION & SESSION TEST SUITE');
  console.log('='.repeat(60));

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

  // 1. Generate Nonce
  console.log('\n1️⃣ Testing Nonce Generation & Message Formatting...');
  const walletA = ethers.Wallet.createRandom();
  const addressA = walletA.address;
  const nonce = await generateNonce(addressA);
  const message = getExpectedSignMessage(nonce);

  assert(Boolean(nonce && nonce.length >= 16), 'Generated high-entropy nonce');
  assert(message.includes('No MSTC will be transferred'), 'EIP-191 sign message contains zero-cost disclosure');
  assert(message.includes(nonce), 'Message includes nonce');
  assert(message.includes('MST Testnet'), 'Message includes network identification');

  // 2. Cryptographic Signature Verification
  console.log('\n2️⃣ Testing EIP-191 Personal Sign Verification...');
  const signatureA = await walletA.signMessage(message);
  const verifyResultA = await verifySignature(addressA, signatureA);
  assert(verifyResultA.success, 'Valid wallet signature verified correctly via ethers.verifyMessage');

  // Negative test: signature mismatch
  const walletB = ethers.Wallet.createRandom();
  const badSig = await walletB.signMessage(message);
  // Generate a new nonce for addressA since previous was single-use
  await generateNonce(addressA);
  const badVerifyResult = await verifySignature(addressA, badSig);
  assert(!badVerifyResult.success, 'Mismatched wallet signature correctly rejected');

  // 3. In-Memory & DB Session Creation
  console.log('\n3️⃣ Testing Session Creation & Retrieval...');
  const session = await createSession(addressA);
  assert(Boolean(session.sessionId), `Session created with ID: ${session.sessionId.slice(0, 16)}...`);
  assert(session.walletAddress === addressA, 'Session wallet address stored');
  assert(session.autoPaymentEnabled === true, 'autoPaymentEnabled defaults to true for active session');

  const fetched = await getSession(session.sessionId);
  assert(Boolean(fetched && fetched.walletAddress === addressA), 'Session retrieved successfully from store');

  // 4. Session Task Payment Authorization (Unlimited Spend Budget)
  console.log('\n4️⃣ Testing Task Auto-Payment Authorization Limit...');
  const authPayRes = await authorizeSessionPayment(session.sessionId, 1000.0);
  assert(Boolean(authPayRes.success && authPayRes.session?.autoPaymentEnabled), 'Auto-payment enabled on session');
  assert(Boolean(authPayRes.session?.sessionLimit && authPayRes.session.sessionLimit >= 1000), 'Session limit set to 1000+ MSTC');
  assert(authPayRes.session?.sessionSpent === 0, 'Initial sessionSpent is 0');

  // 5. Allowance Checking & Deductions
  console.log('\n5️⃣ Testing Allowance Checks & Settlement Deductions...');
  const allowanceOk1 = await checkSessionAllowance(session.sessionId, 0.5);
  assert(allowanceOk1.allowed, 'Task costing 0.5 MSTC approved under session budget');

  const deducted1 = await deductSessionSpend(session.sessionId, 0.5);
  assert(deducted1.session?.sessionSpent === 0.5, '0.5 MSTC deducted upon task deliverable validation and settlement');

  const allowanceOk2 = await checkSessionAllowance(session.sessionId, 0.85);
  assert(allowanceOk2.allowed, 'Second task costing 0.85 MSTC approved');

  const deducted2 = await deductSessionSpend(session.sessionId, 0.85);
  assert(Math.abs((deducted2.session?.sessionSpent || 0) - 1.35) < 0.001, '0.85 MSTC deducted (total spent: 1.35 MSTC)');

  // 6. Account Switching & Session Invalidation
  console.log('\n6️⃣ Testing Account Switch Invalidation & Logout...');
  await invalidateWalletSessions(addressA);
  const afterSwitch = await getSession(session.sessionId);
  assert(afterSwitch === null, 'Switching accounts immediately terminates session for previous wallet');

  console.log('\n' + '='.repeat(60));
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
