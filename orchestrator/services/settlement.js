const { getDb } = require('../db');
const { executeMstAgentSplits } = require('./mst');
const { scoreContributions, allocatePayments } = require('./ledger');
const { v4: uuidv4 } = require('uuid');

async function settleJob(jobId, totalBudget) {
  const db = getDb();
  const jobRow = db.prepare('SELECT buyer_tx FROM jobs WHERE id = ?').get(jobId);
  const buyerTx = jobRow?.buyer_tx ?? null;

  const subtasks = db.prepare(`
    SELECT st.*, a.wallet_address, a.name as agent_name
    FROM subtasks st
    JOIN agents a ON a.id = st.agent_id
    WHERE st.job_id = ? AND st.status = 'completed'
  `).all(jobId);

  if (subtasks.length === 0) {
    throw new Error('No completed subtasks to settle');
  }

  const scored = scoreContributions(subtasks);
  const allocated = allocatePayments(scored, totalBudget);

  const splits = allocated.map(st => ({
    agentId: st.agent_id,
    walletAddress: st.wallet_address,
    amount: st.payment_usdc,
    subtaskId: st.id,
  }));

  const { txMap, settledAt, demo } = await executeMstAgentSplits(splits, jobId, buyerTx);

  const updateSubtask = db.prepare(`
    UPDATE subtasks SET contribution_pct = ?, payment_usdc = ?, payment_tx = ?, status = 'settled'
    WHERE id = ?
  `);
  const updateAgent = db.prepare(`
    UPDATE agents SET total_earned = total_earned + ?, total_jobs = total_jobs + 1, last_active = datetime('now')
    WHERE id = ?
  `);
  const insertTx = db.prepare(`
    INSERT INTO transactions (id, job_id, agent_id, amount_usdc, tx_hash, demo)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const finalResult = [...allocated].sort((a, b) => a.position - b.position).at(-1)?.result ?? null;

  const settle = db.transaction(() => {
    for (const st of allocated) {
      const txHash = txMap[st.agent_id] || buyerTx || null;
      updateSubtask.run(st.contribution_pct, st.payment_usdc, txHash, st.id);
      updateAgent.run(st.payment_usdc, st.agent_id);
      insertTx.run(uuidv4(), jobId, st.agent_id, st.payment_usdc, txHash, demo ? 1 : 0);
    }
    db.prepare(`UPDATE jobs SET status = 'completed', completed_at = ?, result = ? WHERE id = ?`)
      .run(settledAt, finalResult, jobId);
  });

  settle();
  console.log(`[MST Settlement] Job ${jobId} settled: ${totalBudget} MSTC split across ${allocated.length} agents`);

  return { allocated, txMap, settledAt, demo };
}

module.exports = { settleJob };
