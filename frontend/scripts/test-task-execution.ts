/**
 * frontend/scripts/test-task-execution.ts
 *
 * Test full task creation and execution with the updated schema and runner.
 */

import { v4 as uuidv4 } from 'uuid';
import { query, exec, flushNow } from '../src/lib/server/db';
import { ensureSeeded } from '../src/lib/server/seed';
import { runJob } from '../src/lib/server/runner';

async function testTaskExecution() {
  console.log('Testing full task pipeline execution with updated schema...');
  await ensureSeeded();

  const jobId = uuidv4();
  const description = 'Research the main features customers expect from modern e-commerce websites, then summarize the findings into 5 concise points.';

  console.log(`Creating test job: ${jobId}`);
  await exec(
    'INSERT INTO jobs (id, description, status, buyer_tx, payer_address, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
    [jobId, description, 'pending', null, '0xF29b3fe8cb2D49060639ed2b6235a78ab8df2c61', 'session_authorized']
  );
  await flushNow();

  console.log('Running runner for job...');
  await runJob(jobId, description);

  const jobRows = await query('SELECT * FROM jobs WHERE id = ?', [jobId]);
  console.log('Job Result:', {
    id: jobRows[0]?.id,
    status: jobRows[0]?.status,
    payment_status: jobRows[0]?.payment_status,
    error: jobRows[0]?.error,
    resultLength: typeof jobRows[0]?.result === 'string' ? jobRows[0]?.result.length : 0,
  });

  if (jobRows[0]?.status === 'completed' && !jobRows[0]?.error) {
    console.log('✅ PASS: Task executed successfully and deliverable generated with no schema errors!');
  } else {
    console.error('❌ FAIL: Job failed with error:', jobRows[0]?.error);
    process.exit(1);
  }
}

testTaskExecution().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
