/**
 * test-auth-session.ts
 *
 * Automated verification of the AgentMesh Wallet Authentication and
 * Session-based Task Auto-Authorization workflow.
 */

import { ethers } from 'ethers';
import {
  generateNonce,
  verifySignature,
  createSession,
  getSession,
  authorizeSessionPayment,
  checkSessionAllowance,
  deductSessionSpend,
  invalidateSession,
  invalidateWalletSessions,
  formatAuthMessage,
} from '../frontend/src/lib/server/auth';

async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 Running AgentMesh Wallet Auth & Task Authorization Tests');
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
  const nonceObj = generateNonce(addressA);

  assert(Boolean(nonceObj.nonce && nonceObj.nonce.length >= 16), 'Generated high-entropy nonce');
  assert(nonceObj.message.includes('No MSTC will be transferred'), 'EIP-191 sign message is zero-cost disclosure');
  assert(nonceObj.message.includes(addressA), 'Message includes wallet address');
  assert(nonceObj.message.includes(nonceObj.nonce), 'Message includes nonce');

  // 2. Cryptographic Signature Verification
  console.log('\n2️⃣ Testing EIP-191 Personal Sign Verification...');
  const signatureA = await walletA.signMessage(nonceObj.message);
  const isValidSig = verifySignature(addressA, signatureA, nonceObj.message);
  assert(isValidSig, 'Valid wallet signature verified correctly via ethers.verifyMessage');

  // Negative test: signature mismatch
  const walletB = ethers.Wallet.createRandom();
  const badSig = await walletB.signMessage(nonceObj.message);
  const isInvalidSig = verifySignature(addressA, badSig, nonceObj.message);
  assert(!isInvalidSig, 'Mismatched wallet signature correctly rejected');

  // 3. In-Memory Session Creation
  console.log('\n3️⃣ Testing In-Memory Session Creation & Retrieval...');
  const session = createSession(addressA);
  assert(Boolean(session.sessionId), `Session created with ID: ${session.sessionId.slice(0, 12)}...`);
  assert(session.walletAddress === addressA.toLowerCase(), 'Session wallet address normalized to lowercase');
  assert(session.autoPaymentAuthorized === false, 'autoPaymentAuthorized defaults to false (must explicitly authorize limit)');

  const fetched = getSession(session.sessionId);
  assert(Boolean(fetched && fetched.walletAddress === addressA.toLowerCase()), 'Session retrieved successfully from in-memory store');

  // 4. Session Task Payment Authorization (Zero-Popup Auto-Pay Limit)
  console.log('\n4️⃣ Testing Task Auto-Payment Authorization Limit...');
  const updatedSession = authorizeSessionPayment(session.sessionId, 1.5);
  assert(Boolean(updatedSession && updatedSession.autoPaymentAuthorized), 'Auto-payment enabled on session');
  assert(updatedSession?.maxSpendMstc === 1.5, 'Session maxSpendMstc set to 1.5 MSTC');
  assert(updatedSession?.spentMstc === 0, 'Initial spentMstc is 0');

  // 5. Allowance Checking & Deductions
  console.log('\n5️⃣ Testing Allowance Checks & Settlement Deductions...');
  const allowanceOk1 = checkSessionAllowance(session.sessionId, 0.5);
  assert(allowanceOk1.allowed && allowanceOk1.remainingAllowance === 1.5, 'Task costing 0.5 MSTC approved under 1.5 MSTC budget');

  const deducted1 = deductSessionSpend(session.sessionId, 0.5);
  assert(deducted1?.spentMstc === 0.5, '0.5 MSTC deducted upon task deliverable validation and settlement');

  const allowanceOk2 = checkSessionAllowance(session.sessionId, 0.85);
  assert(allowanceOk2.allowed && Math.abs(allowanceOk2.remainingAllowance - 1.0) < 0.001, 'Second task costing 0.85 MSTC approved under remaining 1.0 MSTC budget');

  const deducted2 = deductSessionSpend(session.sessionId, 0.85);
  assert(Math.abs((deducted2?.spentMstc || 0) - 1.35) < 0.001, '0.85 MSTC deducted (total spent: 1.35 MSTC)');

  // Negative test: Exceeding limit
  const allowanceExceeded = checkSessionAllowance(session.sessionId, 0.5);
  assert(!allowanceExceeded.allowed, 'Task costing 0.5 MSTC rejected (remaining budget is 0.15 MSTC)');

  // 6. Conversation Costs 0 MSTC
  console.log('\n6️⃣ Testing Conversational Messages (0 MSTC Cost)...');
  const convAllowance = checkSessionAllowance(session.sessionId, 0);
  assert(convAllowance.allowed, 'Conversations cost 0 MSTC and always pass allowance checks');

  // 7. Account Switching & Session Invalidation
  console.log('\n7️⃣ Testing Account Switch Invalidation & Logout...');
  invalidateWalletSessions(addressA);
  const afterSwitch = getSession(session.sessionId);
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
