import { anchorQueryOnChain, executeMstAgentSplits, getMstProvider, getMstExplorerUrl } from '../src/lib/server/mst';
import { query, exec, flushNow } from '../src/lib/server/db';
import { ensureSeeded } from '../src/lib/server/seed';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  console.log('--- Testing MST Blockchain & Transaction Pipeline ---');
  await ensureSeeded();

  // 1. Check RPC connection
  const provider = getMstProvider();
  const blockNumber = await provider.getBlockNumber();
  console.log(`✅ [RPC] Connected to MST Testnet — Block #${blockNumber}`);

  // 2. User Address under test
  const userAddress = '0xF29b3fe8cb2D49060639ed2b6235a78ab8df2c61';
  const testJobId = uuidv4();
  const testQuery = 'Execute research and data analysis on DeFi protocol yields';

  const txHash = await anchorQueryOnChain(testJobId, testQuery, userAddress);
  console.log(`✅ [Anchor] Query anchored with txHash: ${txHash}`);
  console.log(`   Explorer URL: ${getMstExplorerUrl(txHash)}`);

  // 3. Insert job with buyer_tx and payer_address
  await exec(
    'INSERT INTO jobs (id, description, status, buyer_tx, payer_address) VALUES (?, ?, ?, ?, ?)',
    [testJobId, testQuery, 'completed', txHash, userAddress]
  );

  // 4. Insert transaction with from_address
  const txId = uuidv4();
  await exec(
    'INSERT INTO transactions (id, job_id, agent_id, amount_usdc, tx_hash, demo, from_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [txId, testJobId, 'agent-research', 0.05, txHash, 0, userAddress]
  );
  await flushNow();

  // 5. Query transactions table with JOIN
  const PLATFORM_ESCROW = '0x6001712aE72d24Babc386866d035b6d55331E634';
  const BASE_SQL = `SELECT 
    t.id, t.job_id, t.agent_id, t.amount_usdc, t.amount_usdc as amount_mstc, 'MSTC' as currency,
    t.tx_hash, t.demo, t.created_at,
    COALESCE(a.name, t.agent_id) as agent_name,
    COALESCE(a.skill, 'general') as agent_skill,
    COALESCE(a.wallet_address, '${PLATFORM_ESCROW}') as to_address,
    COALESCE(t.from_address, j.payer_address, '${PLATFORM_ESCROW}') as from_address,
    j.description as job_description,
    CASE WHEN t.amount_usdc <= 0.01 AND t.agent_id = 'agent-summarizer' THEN 'query_anchor' ELSE 'payout' END as type
  FROM transactions t 
  LEFT JOIN agents a ON a.id = t.agent_id 
  LEFT JOIN jobs j ON j.id = t.job_id
  WHERE LOWER(COALESCE(t.from_address, j.payer_address, '')) = ?`;

  const results = await query(BASE_SQL, [userAddress.toLowerCase()]);
  console.log(`✅ [Transactions DB] Retrieved ${results.length} transaction records for user ${userAddress}:`);
  console.log(JSON.stringify(results[0], null, 2));

  // 6. Test agent split execution
  const splits = [
    {
      agentId: 'agent-research',
      walletAddress: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
      mstcAmount: 0.05,
      subtaskId: uuidv4(),
    },
  ];

  const splitResult = await executeMstAgentSplits(splits, testJobId, txHash);
  console.log('✅ [Splits] Agent payouts generated:');
  console.log(JSON.stringify(splitResult, null, 2));

  console.log('\n======================================================');
  console.log(`🎉 ALL TESTS PASSED FOR WALLET: ${userAddress}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
