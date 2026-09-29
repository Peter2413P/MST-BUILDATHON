import fs from 'fs';
import path from 'path';

try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...v] = trimmed.split('=');
        process.env[k.trim()] = v.join('=').trim();
      }
    }
  }
} catch {}

import { routeMessage, type RouterContext, type RouterOutput } from '../src/lib/server/router';

interface TestCase {
  id: number;
  message: string;
  expectedIntent: 'conversation' | 'task';
  context?: Partial<RouterContext>;
  description: string;
}

const TEST_CASES: TestCase[] = [
  {
    id: 1,
    message: 'Calculate 20% of ₹500.',
    expectedIntent: 'task',
    description: 'Direct mathematical calculation request',
  },
  {
    id: 2,
    message: 'What is 20%?',
    expectedIntent: 'conversation',
    description: 'Conceptual mathematical question',
  },
  {
    id: 3,
    message: 'Create a chart from those numbers.',
    expectedIntent: 'task',
    context: {
      previous_task: {
        id: 'job-123',
        status: 'completed',
        result: 'Q1: $10,000, Q2: $14,000, Q3: $18,000',
      },
    },
    description: 'Follow-up task creating visualization from previous data',
  },
  {
    id: 4,
    message: 'Why does the chart show 40%?',
    expectedIntent: 'conversation',
    context: {
      previous_task: {
        id: 'job-123',
        status: 'completed',
        result: 'Bar chart created showing 40% QoQ growth',
      },
    },
    description: 'Follow-up question explaining chart insight',
  },
  {
    id: 5,
    message: 'Translate the result to Tamil.',
    expectedIntent: 'task',
    context: {
      previous_task: {
        id: 'job-123',
        status: 'completed',
        result: 'Revenue grew by 40% in Q2.',
      },
    },
    description: 'Follow-up task requesting translation of previous result',
  },
  {
    id: 6,
    message: 'Explain the translated result.',
    expectedIntent: 'conversation',
    context: {
      previous_task: {
        id: 'job-124',
        status: 'completed',
        result: 'இரண்டாம் காலாண்டில் வருவாய் 40% அதிகரித்தது.',
      },
    },
    description: 'Follow-up request for explanation of translated text',
  },
  {
    id: 7,
    message: 'Why did FinanceAgent fail?',
    expectedIntent: 'conversation',
    context: {
      previous_task: {
        id: 'job-125',
        status: 'failed',
        error: 'Input financial statement was empty or truncated',
      },
    },
    description: 'Failure inquiry (must NOT re-hire FinanceAgent)',
  },
  {
    id: 8,
    message: 'Retry the calculation with Q3 included.',
    expectedIntent: 'task',
    context: {
      previous_task: {
        id: 'job-123',
        status: 'completed',
        result: 'Q1: 10, Q2: 14',
      },
    },
    description: 'Explicit retry/re-calculation request with new input',
  },
  {
    id: 9,
    message: 'What agents are available?',
    expectedIntent: 'conversation',
    description: 'System capability inquiry',
  },
  {
    id: 10,
    message: 'Build me an e-commerce website.',
    expectedIntent: 'task',
    description: 'Complex multi-agent development task',
  },
  {
    id: 11,
    message: 'How much did my previous task cost?',
    expectedIntent: 'conversation',
    context: {
      previous_task: {
        id: 'job-123',
        status: 'completed',
        settlement_mstc: 0.02,
      },
    },
    description: 'Payment/cost inquiry (must NOT charge new MSTC)',
  },
  {
    id: 12,
    message: 'Do the same task again.',
    expectedIntent: 'task',
    context: {
      previous_task: {
        id: 'job-123',
        status: 'completed',
        description: 'Extract table from invoice.pdf',
      },
    },
    description: 'Re-execution request inheriting previous task description',
  },
  {
    id: 13,
    message: 'Can you help me with this?',
    expectedIntent: 'conversation',
    description: 'Ambiguous request (must ask clarification without charging)',
  },
  {
    id: 14,
    message: 'Analyze this dataset.',
    expectedIntent: 'task',
    description: 'Explicit data analysis task',
  },
];

async function runTests() {
  console.log('===============================================================');
  console.log('🚀 RUNNING AGENTMESH CONVERSATION INTELLIGENCE ROUTER TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  for (const tc of TEST_CASES) {
    const context: RouterContext = {
      current_message: tc.message,
      previous_task: tc.context?.previous_task || null,
      recent_messages: tc.context?.recent_messages || [],
      wallet: { address: '0x6001712aE72d24Babc386866d035b6d55331E634', authenticated: true },
    };

    try {
      const output = await routeMessage(context);

      const isPass = output.intent === tc.expectedIntent;

      // Strict validation rules check
      if (output.intent === 'conversation') {
        if (output.requires_execution !== false || output.requires_payment !== false || output.task_summary !== null) {
          console.error(`❌ [FAILED STRICT RULE] Test ${tc.id}: Conversation output violated schema constraints!`);
        }
      } else {
        if (output.requires_execution !== true || output.requires_payment !== true || typeof output.task_summary !== 'string') {
          console.error(`❌ [FAILED STRICT RULE] Test ${tc.id}: Task output violated schema constraints!`);
        }
      }

      if (isPass) {
        passed++;
        console.log(`✅ [PASS] Test #${tc.id}: "${tc.message}"`);
        console.log(`   → Intent: ${output.intent.toUpperCase()} (Expected: ${tc.expectedIntent.toUpperCase()}) | Confidence: ${output.confidence} | Reason: ${output.reason}`);
        if (output.task_summary) console.log(`   → Task Summary: "${output.task_summary}"`);
      } else {
        failed++;
        console.error(`❌ [FAIL] Test #${tc.id}: "${tc.message}"`);
        console.error(`   → Got: ${output.intent.toUpperCase()}, Expected: ${tc.expectedIntent.toUpperCase()} | Reason: ${output.reason}`);
      }
    } catch (err) {
      failed++;
      console.error(`❌ [ERROR] Test #${tc.id} threw an exception:`, err);
    }
    console.log('---------------------------------------------------------------');
  }

  console.log(`\n===============================================================`);
  console.log(`📊 TEST RESULTS: ${passed}/${TEST_CASES.length} PASSED (${failed} FAILED)`);
  console.log(`===============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
