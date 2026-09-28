import { v4 as uuidv4 } from 'uuid';
import { query, exec, flushNow } from './db';
import { decomposeJob, type SubtaskPlan } from './planner';
import { runAgentInline } from './agents';
import { executeMstAgentSplits } from './mst';
import type { SubtaskStatus, ValidationStatus } from '../types';

const SLASH_AMOUNT = 0.01;
const MIN_BOND = 0.01;
const MAX_RETRIES = 1;
const SUBTASK_TIMEOUT_MS = 25_000;
const JOB_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMsg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMsg));
    }, timeoutMs);

    promise
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Refusal / missing-input patterns that indicate agent could not perform the task
const REFUSAL_PATTERNS = [
  /i('m| am) (sorry|unable|not able)/i,
  /i (cannot|can't|couldn't|don't have (access|the ability))/i,
  /as an? (ai|language model|llm)/i,
  /i do not have (access|the ability|real.time)/i,
  /no (audio|image|file|document|report|attachment|text|data) (was |is )?provided/i,
  /missing (required|input|document|data|context)/i,
  /please (provide|upload|attach|specify)/i,
];

interface DAGTaskNode {
  id: string;              // DB UUID
  planId: string;          // e.g. "task_1", "task_2"
  skill: string;
  prompt: string;
  dependencies: string[];  // list of planId strings
  optional: boolean;
  complexity_weight: number;
  position: number;
  status: SubtaskStatus;
  validation_status: ValidationStatus;
  agentId: string | null;
  agentName: string | null;
  walletAddress?: string | null;
  result: string | null;
  error: string | null;
  error_type: string | null;
  blocked_by: string | null;
  tokens_used: number;
  quality_score: number;
  retry_count: number;
}

interface ValidationResult {
  isValid: boolean;
  errorType?: 'missing_input' | 'refusal' | 'empty_output' | 'execution_error';
  errorMessage?: string;
  cleanedResult?: string;
}

/**
 * Validates the raw agent output in a task-aware manner.
 * Ensures it contains a legitimate task deliverable for the specific skill/domain
 * without relying on a generic blunt character length threshold.
 */
function validateAgentOutput(
  rawOutput: string | null | undefined,
  skill?: string,
  prompt?: string
): ValidationResult {
  if (rawOutput === null || rawOutput === undefined || typeof rawOutput !== 'string') {
    return {
      isValid: false,
      errorType: 'empty_output',
      errorMessage: 'Agent produced null or undefined output.',
    };
  }

  const trimmed = rawOutput.trim();

  // 1. Strictly reject empty or blank strings
  if (trimmed.length === 0) {
    return {
      isValid: false,
      errorType: 'empty_output',
      errorMessage: 'Agent produced empty or blank output.',
    };
  }

  // 2. Reject explicit bare error tokens
  const lower = trimmed.toLowerCase();
  if (
    lower === 'error' ||
    lower === 'failed' ||
    lower === 'failure' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'nan' ||
    lower === '[failed]' ||
    lower === 'internal server error' ||
    /^error:\s*(undefined|null|failed|none)$/i.test(trimmed)
  ) {
    return {
      isValid: false,
      errorType: 'execution_error',
      errorMessage: `Agent returned error token: "${trimmed}"`,
    };
  }

  // 3. Check for explicit refusal or missing input phrases
  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(trimmed)) {
      // If the response is brief and contains refusal, mark as missing_input
      if (trimmed.length < 400) {
        return {
          isValid: false,
          errorType: 'missing_input',
          errorMessage: trimmed.slice(0, 200),
        };
      }
    }
  }

  // 4. Task-aware domain validation based on skill
  if (skill) {
    switch (skill) {
      case 'extract': {
        // If JSON output is present, verify it parses and has keys
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'object' && parsed !== null) {
              const keys = Object.keys(parsed);
              if (keys.length === 0 && (!Array.isArray(parsed) || parsed.length === 0)) {
                return {
                  isValid: false,
                  errorType: 'empty_output',
                  errorMessage: 'Extraction produced an empty JSON object or array.',
                };
              }
            }
          } catch {
            const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
              try {
                JSON.parse(jsonMatch[1]);
              } catch {
                return {
                  isValid: false,
                  errorType: 'empty_output',
                  errorMessage: 'Extraction produced malformed JSON.',
                };
              }
            }
          }
        }
        break;
      }

      case 'finance': {
        // Numerical / financial calculation tasks must contain numerical digits, percentages, currency, or metric terms
        const hasNumberOrPercent = /\d|\%|\$|₹|€|£|INR|USD|lakh|crore|growth|revenue|profit|margin|cost|ratio|percent/i.test(trimmed);
        if (!hasNumberOrPercent && trimmed.length < 40) {
          return {
            isValid: false,
            errorType: 'empty_output',
            errorMessage: 'Finance agent did not produce a numerical calculation or financial metric.',
          };
        }
        break;
      }

      case 'sql': {
        // Should contain SQL keywords or SQL code block
        const hasSql = /SELECT|INSERT|UPDATE|DELETE|CREATE|WITH|FROM|WHERE|JOIN|GROUP BY/i.test(trimmed) || trimmed.includes('```');
        if (!hasSql) {
          return {
            isValid: false,
            errorType: 'empty_output',
            errorMessage: 'SQL agent did not produce valid SQL statement.',
          };
        }
        break;
      }

      case 'chart': {
        // Should contain JSON or chart configuration structure
        const hasChart = /\{[\s\S]*\}|type|data|labels|datasets|Chart/i.test(trimmed);
        if (!hasChart) {
          return {
            isValid: false,
            errorType: 'empty_output',
            errorMessage: 'Chart agent did not produce chart configuration specification.',
          };
        }
        break;
      }

      case 'fact-check': {
        // Should contain verdict or claim verification
        const hasVerdict = /true|false|unverifiable|partially|claim|verdict|confidence|accuracy/i.test(trimmed);
        if (!hasVerdict && trimmed.length < 30) {
          return {
            isValid: false,
            errorType: 'empty_output',
            errorMessage: 'Fact-check agent did not produce claim verification verdict.',
          };
        }
        break;
      }

      case 'sentiment': {
        // Should contain sentiment classification or score
        const hasSentiment = /positive|negative|neutral|score|sentiment|emotion|confidence/i.test(trimmed);
        if (!hasSentiment && trimmed.length < 25) {
          return {
            isValid: false,
            errorType: 'empty_output',
            errorMessage: 'Sentiment agent did not produce sentiment classification.',
          };
        }
        break;
      }
    }
  }

  return {
    isValid: true,
    cleanedResult: trimmed,
  };
}

/**
 * Dependency evaluation for a task graph node.
 * Determines whether a task is READY to execute, WAITING for upstream nodes, or BLOCKED by a failure.
 */
function evaluateDependencies(
  node: DAGTaskNode,
  allNodes: Map<string, DAGTaskNode>
): { state: 'READY' | 'WAITING' | 'BLOCKED'; blockedBy?: string; reason?: string } {
  if (!node.dependencies || node.dependencies.length === 0) {
    return { state: 'READY' };
  }

  for (const depPlanId of node.dependencies) {
    const depNode = allNodes.get(depPlanId);
    if (!depNode) {
      return {
        state: 'BLOCKED',
        blockedBy: depPlanId,
        reason: `Prerequisite dependency "${depPlanId}" not found in task graph.`,
      };
    }

    // If prerequisite failed, was blocked, was cancelled, or has invalid validation
    if (
      depNode.status === 'failed' ||
      depNode.status === 'blocked' ||
      depNode.status === 'cancelled' ||
      depNode.validation_status === 'invalid'
    ) {
      const depName = depNode.agentName || `${depNode.skill} Task (${depPlanId})`;
      return {
        state: 'BLOCKED',
        blockedBy: depNode.id,
        reason: `Blocked because prerequisite ${depName} failed: ${depNode.error || 'did not produce valid output'}.`,
      };
    }

    // If prerequisite is still in-flight
    if (
      depNode.status === 'pending' ||
      depNode.status === 'ready' ||
      depNode.status === 'running' ||
      depNode.status === 'retrying'
    ) {
      return { state: 'WAITING' };
    }

    // If prerequisite completed successfully and validated
    if (depNode.status === 'completed' || depNode.status === 'settled') {
      if (depNode.validation_status !== 'valid') {
        return {
          state: 'BLOCKED',
          blockedBy: depNode.id,
          reason: `Prerequisite ${depNode.skill} output failed validation.`,
        };
      }
      // satisfied, check next
    }
  }

  return { state: 'READY' };
}

/**
 * Recursively propagates failure down the DAG to block all reachable dependent tasks.
 */
function propagateFailure(failedPlanId: string, allNodes: Map<string, DAGTaskNode>, failedNodeId: string, reason: string) {
  for (const [, node] of allNodes) {
    if (node.status === 'pending' && node.dependencies.includes(failedPlanId)) {
      node.status = 'blocked';
      node.validation_status = 'invalid';
      node.blocked_by = failedNodeId;
      node.error = `Blocked because prerequisite task (${failedPlanId}) failed: ${reason}`;
      node.error_type = 'dependency_failure';
      console.log(`[Fail-Fast] Subtask ${node.planId} (${node.skill}) is BLOCKED by ${failedPlanId}`);
      // Recurse for downstream dependents of this newly blocked node
      propagateFailure(node.planId, allNodes, node.id, reason);
    }
  }
}

interface ScoredRow {
  id: string;
  agent_id: string;
  wallet_address: string;
  tokens_used: number;
  complexity_weight: number;
  quality_score: number;
  contribution_pct: number;
  payment_usdc: number;
}

function scoreAndAllocate(subtasks: DAGTaskNode[], totalBudget: number): ScoredRow[] {
  const scored = subtasks.map(st => ({
    id: st.id,
    agent_id: st.agentId!,
    wallet_address: st.walletAddress ?? '0x0000000000000000000000000000000000000000',
    tokens_used: st.tokens_used,
    complexity_weight: st.complexity_weight,
    quality_score: st.quality_score || 1.0,
    raw_score: Math.min(st.tokens_used / 1000, 5) * st.complexity_weight * (st.quality_score || 1.0),
  }));
  const totalRaw = scored.reduce((s, st) => s + st.raw_score, 0);
  const even = scored.length > 0 ? 1 / scored.length : 1;
  return scored.map(st => {
    const pct = totalRaw === 0 ? even : st.raw_score / totalRaw;
    return { ...st, contribution_pct: pct, payment_usdc: parseFloat((pct * totalBudget).toFixed(6)) };
  });
}

/**
 * Main Autonomous Job Orchestration Engine (DAG & Fail-Fast).
 */
export async function runJob(jobId: string, description: string) {
  // Fetch buyer tx if previously recorded
  const jobRows = await query('SELECT buyer_tx FROM jobs WHERE id = ?', [jobId]);
  const buyerTx = (jobRows[0]?.buyer_tx as string) ?? null;

  await exec('UPDATE jobs SET status = ? WHERE id = ?', ['planning', jobId]);
  const agents = await query('SELECT * FROM agents WHERE status != ?', ['offline']);
  const plan = await decomposeJob(description, agents as unknown as Parameters<typeof decomposeJob>[1]);

  const nodesMap = new Map<string, DAGTaskNode>();

  // Initialize DAG Nodes in Database and Memory
  for (let i = 0; i < plan.subtasks.length; i++) {
    const st = plan.subtasks[i];
    const planId = st.id || `task_${i + 1}`;
    const dbId = uuidv4();
    const deps = st.dependencies ?? (i > 0 ? [`task_${i}`] : []);

    const node: DAGTaskNode = {
      id: dbId,
      planId,
      skill: st.skill,
      prompt: st.prompt,
      dependencies: deps,
      optional: Boolean(st.optional),
      complexity_weight: st.complexity_weight || 1.0,
      position: st.position || (i + 1),
      status: 'pending',
      validation_status: 'pending',
      agentId: null,
      agentName: null,
      walletAddress: null,
      result: null,
      error: null,
      error_type: null,
      blocked_by: null,
      tokens_used: 0,
      quality_score: 1.0,
      retry_count: 0,
    };

    nodesMap.set(planId, node);

    await exec(
      `INSERT INTO subtasks (
        id, job_id, agent_id, skill, prompt, dependencies,
        optional, complexity_weight, position, status, validation_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dbId,
        jobId,
        null,
        node.skill,
        node.prompt,
        JSON.stringify(node.dependencies),
        node.optional ? 1 : 0,
        node.complexity_weight,
        node.position,
        'pending',
        'pending',
      ]
    );
  }

  await flushNow();
  await exec('UPDATE jobs SET status = ? WHERE id = ?', ['running', jobId]);

  // DAG Orchestration Loop
  let loopActive = true;
  let safetyCounter = 0;
  const loopStartTime = Date.now();
  const maxIterations = plan.subtasks.length * 4 + 10;

  while (loopActive && safetyCounter++ < maxIterations) {
    if (Date.now() - loopStartTime > JOB_TIMEOUT_MS) {
      console.warn(`[Job ${jobId}] Hit maximum execution timeout (${JOB_TIMEOUT_MS}ms)`);
      break;
    }

    const pendingNodes = Array.from(nodesMap.values()).filter(
      n => n.status === 'pending' || n.status === 'ready' || n.status === 'retrying'
    );

    if (pendingNodes.length === 0) {
      loopActive = false;
      break;
    }

    let actionTakenInThisPass = false;

    for (const node of pendingNodes) {
      // 1. Check dependency readiness
      const depEval = evaluateDependencies(node, nodesMap);

      if (depEval.state === 'BLOCKED') {
        node.status = 'blocked';
        node.validation_status = 'invalid';
        node.blocked_by = depEval.blockedBy ?? null;
        node.error = depEval.reason ?? 'Blocked by prerequisite failure';
        node.error_type = 'dependency_failure';

        await exec(
          `UPDATE subtasks SET
            status = 'blocked',
            validation_status = 'invalid',
            blocked_by = ?,
            error = ?,
            error_type = ?,
            completed_at = ?
           WHERE id = ?`,
          [node.blocked_by, node.error, node.error_type, new Date().toISOString(), node.id]
        );

        propagateFailure(node.planId, nodesMap, node.id, node.error);
        actionTakenInThisPass = true;
        continue;
      }

      if (depEval.state === 'WAITING') {
        // Still waiting for upstream dependencies to finish
        continue;
      }

      // depEval.state === 'READY'
      actionTakenInThisPass = true;

      // 2. Discover and Hire Agent ONLY for READY tasks
      const agentRows = await query(
        'SELECT * FROM agents WHERE skill = ? AND status = ? ORDER BY avg_quality DESC, price_usdc ASC LIMIT 1',
        [node.skill, 'available']
      );
      const agent = agentRows[0] as { id: string; name: string; wallet_address: string; price_usdc: number } | undefined;

      if (!agent) {
        node.status = 'failed';
        node.validation_status = 'invalid';
        node.error = `No available agent in registry with capability: ${node.skill}`;
        node.error_type = 'missing_agent';

        await exec(
          `UPDATE subtasks SET
            status = 'failed',
            validation_status = 'invalid',
            error = ?,
            error_type = ?,
            completed_at = ?
           WHERE id = ?`,
          [node.error, node.error_type, new Date().toISOString(), node.id]
        );

        propagateFailure(node.planId, nodesMap, node.id, node.error);
        continue;
      }

      node.agentId = agent.id;
      node.agentName = agent.name;
      node.walletAddress = agent.wallet_address;
      node.status = 'running';

      await exec(
        `UPDATE subtasks SET agent_id = ?, status = 'running', started_at = ? WHERE id = ?`,
        [agent.id, new Date().toISOString(), node.id]
      );

      // 3. Assemble prerequisite context ONLY from valid direct upstream dependencies
      const contextPieces: string[] = [];
      for (const dPlanId of node.dependencies) {
        const dNode = nodesMap.get(dPlanId);
        if (dNode && (dNode.status === 'completed' || dNode.status === 'settled') && dNode.result) {
          contextPieces.push(`### Context from ${dNode.agentName || dNode.skill} (${dPlanId}):\n${dNode.result}`);
        }
      }
      const aggregatedContext = contextPieces.join('\n\n');

      // 4. Dispatch and Execute Agent with timeout
      try {
        const { result: rawResult, tokensUsed, qualityScore } = await withTimeout(
          runAgentInline(node.skill, node.prompt, aggregatedContext),
          SUBTASK_TIMEOUT_MS,
          `Agent execution timed out after ${SUBTASK_TIMEOUT_MS / 1000}s`
        );

        console.log(`[${node.agentName || node.skill}] raw output:\n${rawResult}`);
        console.log(`[${node.agentName || node.skill}] output length:\n${rawResult ? rawResult.length : 0}`);

        // 5. Rigorous Task-Aware Output Validation Check
        const validation = validateAgentOutput(rawResult, node.skill, node.prompt);
        console.log(`[${node.agentName || node.skill}] validation result:`, validation);

        if (!validation.isValid) {
          console.warn(`[Validation Failure] Subtask ${node.planId} (${node.skill}): ${validation.errorMessage}`);

          // Attempt retry with corrective prompt if retries remain and it is not an explicit missing-input refusal
          if (node.retry_count < MAX_RETRIES && validation.errorType !== 'missing_input') {
            node.retry_count++;
            node.status = 'retrying';
            console.log(`[Validation Retry] Retrying subtask ${node.planId} (${node.skill}) due to: ${validation.errorMessage} (attempt ${node.retry_count}/${MAX_RETRIES})`);
            node.prompt = `${node.prompt}\n\n[Correction Notice]: Your previous response could not be validated (${validation.errorMessage}). Return the calculated or required result with the formula and values. Do not omit the numerical/factual result.`;
            await exec(
              `UPDATE subtasks SET status = 'retrying', retry_count = ?, prompt = ? WHERE id = ?`,
              [node.retry_count, node.prompt, node.id]
            );
            continue;
          }

          node.status = 'failed';
          node.validation_status = 'invalid';
          node.result = null; // Do NOT pass error text as valid result
          node.error = validation.errorMessage || 'Output validation failed';
          node.error_type = validation.errorType || 'refusal';
          node.tokens_used = tokensUsed;
          node.quality_score = 0.0;

          await exec(
            `UPDATE subtasks SET
              status = 'failed',
              validation_status = 'invalid',
              result = NULL,
              tokens_used = ?,
              quality_score = 0.0,
              error = ?,
              error_type = ?,
              completed_at = ?
             WHERE id = ?`,
            [tokensUsed, node.error, node.error_type, new Date().toISOString(), node.id]
          );

          await exec('UPDATE agents SET avg_quality = MAX(0.1, avg_quality * 0.9) WHERE id = ?', [agent.id]);
          await slashAgent(agent.id, jobId, node.error.slice(0, 120));

          // Propagate fail-fast to downstream tasks
          propagateFailure(node.planId, nodesMap, node.id, node.error);
        } else {
          // Output Valid and Successful!
          node.status = 'completed';
          node.validation_status = 'valid';
          node.result = validation.cleanedResult!;
          node.error = null;
          node.tokens_used = tokensUsed;
          node.quality_score = qualityScore;

          await exec(
            `UPDATE subtasks SET
              status = 'completed',
              validation_status = 'valid',
              result = ?,
              tokens_used = ?,
              quality_score = ?,
              error = NULL,
              completed_at = ?
             WHERE id = ?`,
            [node.result, tokensUsed, qualityScore, new Date().toISOString(), node.id]
          );

          await exec(
            'UPDATE agents SET avg_quality = MIN(1.0, MAX(0.1, avg_quality * 0.9 + ? * 0.1)) WHERE id = ?',
            [qualityScore, agent.id]
          );
        }
      } catch (execErr) {
        const errMsg = (execErr as Error).message ?? 'Agent execution error';
        console.error(`[Execution Error] Subtask ${node.planId} (${node.skill}):`, errMsg);

        // Check if retry is applicable
        if (node.retry_count < MAX_RETRIES && !REFUSAL_PATTERNS.some(p => p.test(errMsg))) {
          node.retry_count++;
          node.status = 'retrying';
          console.log(`[Retry] Retrying subtask ${node.planId} (attempt ${node.retry_count}/${MAX_RETRIES})`);
          await exec(
            `UPDATE subtasks SET status = 'retrying', retry_count = ? WHERE id = ?`,
            [node.retry_count, node.id]
          );
          continue;
        }

        node.status = 'failed';
        node.validation_status = 'invalid';
        node.result = null;
        node.error = errMsg;
        node.error_type = 'execution_error';

        await exec(
          `UPDATE subtasks SET
            status = 'failed',
            validation_status = 'invalid',
            result = NULL,
            quality_score = 0.0,
            error = ?,
            error_type = ?,
            completed_at = ?
           WHERE id = ?`,
          [errMsg, 'execution_error', new Date().toISOString(), node.id]
        );

        await exec('UPDATE agents SET avg_quality = MAX(0.1, avg_quality * 0.9) WHERE id = ?', [agent.id]);
        await slashAgent(agent.id, jobId, errMsg.slice(0, 120));

        propagateFailure(node.planId, nodesMap, node.id, errMsg);
      }
    }

    if (!actionTakenInThisPass) {
      // No tasks could advance this pass (either all remaining are waiting or locked)
      break;
    }
  }

  // ── Post-DAG Evaluation & Settlement ─────────────────────────────────────────
  await exec('UPDATE jobs SET status = ? WHERE id = ?', ['settling', jobId]);

  const allNodesList = Array.from(nodesMap.values());
  const completedNodes = allNodesList.filter(n => n.status === 'completed' && n.validation_status === 'valid' && n.result);
  const mandatoryFailedNodes = allNodesList.filter(n => !n.optional && (n.status === 'failed' || n.status === 'blocked'));

  // Calculate actual cost ONLY for completed and validated subtasks
  let totalCost = 0;
  for (const st of completedNodes) {
    if (!st.agentId) continue;
    const rows = await query('SELECT price_usdc FROM agents WHERE id = ?', [st.agentId]);
    if (rows[0]) totalCost += (rows[0].price_usdc as number) * st.complexity_weight;
  }
  totalCost = parseFloat(totalCost.toFixed(6));
  await exec('UPDATE jobs SET total_price_usdc = ? WHERE id = ?', [totalCost, jobId]);

  // If any mandatory subtask failed, the overall task status is FAILED
  if (mandatoryFailedNodes.length > 0 || completedNodes.length === 0) {
    const rootFailure = mandatoryFailedNodes.find(n => n.status === 'failed') ?? mandatoryFailedNodes[0];
    const failureMsg = rootFailure
      ? `Task could not be completed because ${rootFailure.skill} agent failed: ${rootFailure.error || 'prerequisite unsatisfied'}`
      : 'All subtasks failed — no output produced';

    await exec(
      'UPDATE jobs SET status = ?, error = ?, completed_at = ? WHERE id = ?',
      ['failed', failureMsg, new Date().toISOString(), jobId]
    );
    console.log(`[Job ${jobId}] Finished with status: FAILED (${failureMsg})`);
    await flushNow();
    return;
  }

  // Synthesize final result across completed subtasks without discarding deliverables
  let finalResult: string | null = null;
  const sortedNodes = completedNodes.sort((a, b) => a.position - b.position);
  if (sortedNodes.length === 1) {
    finalResult = sortedNodes[0].result;
  } else if (sortedNodes.length > 1) {
    const sections: string[] = [];
    for (const node of sortedNodes) {
      if (node.result && node.result.trim()) {
        sections.push(node.result.trim());
      }
    }
    finalResult = sections.join('\n\n');
  }

  try {
    const allocated = scoreAndAllocate(completedNodes, totalCost);

    const splits = allocated.map(st => ({
      agentId: st.agent_id,
      walletAddress: st.wallet_address,
      mstcAmount: st.payment_usdc,
      subtaskId: st.id,
    }));

    const { txMap, settledAt, demo } = await executeMstAgentSplits(splits, jobId, buyerTx);

    for (const st of allocated) {
      const txHash = txMap[st.agent_id] ?? buyerTx ?? null;
      await exec(
        'UPDATE subtasks SET contribution_pct = ?, payment_usdc = ?, payment_tx = ?, status = ? WHERE id = ?',
        [st.contribution_pct, st.payment_usdc, txHash, 'settled', st.id]
      );
      await exec(
        'UPDATE agents SET total_earned = total_earned + ?, total_jobs = total_jobs + 1, last_active = ? WHERE id = ?',
        [st.payment_usdc, new Date().toISOString(), st.agent_id]
      );
      await exec(
        'INSERT INTO transactions (id, job_id, agent_id, amount_usdc, tx_hash, demo) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), jobId, st.agent_id, st.payment_usdc, txHash, demo ? 1 : 0]
      );
    }

    await exec('UPDATE jobs SET status = ?, completed_at = ?, result = ?, error = NULL WHERE id = ?', [
      'completed',
      settledAt,
      finalResult,
      jobId,
    ]);
    console.log(`[MST Settlement] Job ${jobId} settled: ${totalCost} MSTC across ${allocated.length} agents`);
    await flushNow();
  } catch (settleErr) {
    console.error(`[Job ${jobId}] Settlement failed:`, (settleErr as Error).message);
    await exec(
      'UPDATE jobs SET status = ?, completed_at = ?, result = ? WHERE id = ?',
      ['completed', new Date().toISOString(), finalResult, jobId]
    );
    await flushNow();
  }
}

/**
 * Direct single agent hire.
 */
export async function runDirectJob(jobId: string, description: string, agentId: string) {
  const jobRows = await query('SELECT buyer_tx FROM jobs WHERE id = ?', [jobId]);
  const buyerTx = (jobRows[0]?.buyer_tx as string) ?? null;

  const agentRows = await query('SELECT * FROM agents WHERE id = ?', [agentId]);
  const agent = agentRows[0] as { id: string; skill: string; price_usdc: number; wallet_address: string; name: string } | undefined;
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const totalCost = parseFloat(agent.price_usdc.toFixed(6));
  await exec('UPDATE jobs SET status = ?, total_price_usdc = ? WHERE id = ?', ['running', totalCost, jobId]);

  const stId = uuidv4();
  await exec(
    `INSERT INTO subtasks (
      id, job_id, agent_id, skill, prompt, complexity_weight, position, status, validation_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [stId, jobId, agentId, agent.skill, description, 1.0, 0, 'running', 'pending']
  );

  let finalResult: string | null = null;
  try {
    const { result: rawResult, tokensUsed, qualityScore } = await withTimeout(
      runAgentInline(agent.skill, description, ''),
      SUBTASK_TIMEOUT_MS,
      `Agent execution timed out after ${SUBTASK_TIMEOUT_MS / 1000}s`
    );

    console.log(`[Direct: ${agent.name || agent.skill}] raw output:\n${rawResult}`);
    console.log(`[Direct: ${agent.name || agent.skill}] output length:\n${rawResult ? rawResult.length : 0}`);

    const validation = validateAgentOutput(rawResult, agent.skill, description);
    console.log(`[Direct: ${agent.name || agent.skill}] validation result:`, validation);

    if (!validation.isValid) {
      const errMsg = validation.errorMessage || 'Output validation failed';
      await exec(
        `UPDATE subtasks SET
          status = 'failed',
          validation_status = 'invalid',
          result = NULL,
          tokens_used = ?,
          quality_score = 0.0,
          error = ?,
          completed_at = ?
         WHERE id = ?`,
        [tokensUsed, errMsg, new Date().toISOString(), stId]
      );
      await exec('UPDATE agents SET avg_quality = MAX(0.1, avg_quality * 0.9) WHERE id = ?', [agentId]);
      await slashAgent(agentId, jobId, errMsg.slice(0, 120));
      await exec(
        'UPDATE jobs SET status = ?, error = ?, completed_at = ? WHERE id = ?',
        ['failed', errMsg, new Date().toISOString(), jobId]
      );
      await flushNow();
      return;
    }

    finalResult = validation.cleanedResult!;
    await exec(
      `UPDATE subtasks SET
        status = 'completed',
        validation_status = 'valid',
        result = ?,
        tokens_used = ?,
        quality_score = ?,
        completed_at = ?
       WHERE id = ?`,
      [finalResult, tokensUsed, qualityScore, new Date().toISOString(), stId]
    );
    await exec(
      'UPDATE agents SET avg_quality = MIN(1.0, MAX(0.1, avg_quality * 0.9 + ? * 0.1)) WHERE id = ?',
      [qualityScore, agentId]
    );
  } catch (err) {
    const msg = (err as Error).message ?? 'Unknown error';
    await exec(
      `UPDATE subtasks SET status = 'failed', validation_status = 'invalid', result = NULL, error = ?, completed_at = ? WHERE id = ?`,
      [msg, new Date().toISOString(), stId]
    );
    await exec('UPDATE agents SET avg_quality = MAX(0.1, avg_quality * 0.9) WHERE id = ?', [agentId]);
    await slashAgent(agentId, jobId, msg.slice(0, 120));
    await exec(
      'UPDATE jobs SET status = ?, error = ?, completed_at = ? WHERE id = ?',
      ['failed', msg, new Date().toISOString(), jobId]
    );
    await flushNow();
    return;
  }

  await exec('UPDATE jobs SET status = ? WHERE id = ?', ['settling', jobId]);

  try {
    const splits = [{ agentId, walletAddress: agent.wallet_address, mstcAmount: totalCost, subtaskId: stId }];
    const { txMap, settledAt, demo } = await executeMstAgentSplits(splits, jobId, buyerTx);
    const txHash = txMap[agentId] ?? buyerTx ?? null;

    await exec(
      'UPDATE subtasks SET contribution_pct = ?, payment_usdc = ?, payment_tx = ?, status = ? WHERE id = ?',
      [1.0, totalCost, txHash, 'settled', stId]
    );
    await exec(
      'UPDATE agents SET total_earned = total_earned + ?, total_jobs = total_jobs + 1, last_active = ? WHERE id = ?',
      [totalCost, new Date().toISOString(), agentId]
    );
    await exec(
      'INSERT INTO transactions (id, job_id, agent_id, amount_usdc, tx_hash, demo) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), jobId, agentId, totalCost, txHash, demo ? 1 : 0]
    );
    await exec('UPDATE jobs SET status = ?, completed_at = ?, result = ? WHERE id = ?', ['completed', settledAt, finalResult, jobId]);
    await flushNow();
  } catch (err) {
    console.error(`[DirectJob ${jobId}] Settlement failed:`, (err as Error).message);
    await exec('UPDATE jobs SET status = ?, completed_at = ?, result = ? WHERE id = ?', ['completed', new Date().toISOString(), finalResult, jobId]);
    await flushNow();
  }
}

export async function slashAgent(agentId: string, jobId: string | null, reason: string) {
  const rows = await query('SELECT bond_amount, bond_slashed FROM agents WHERE id = ?', [agentId]) as { bond_amount: number; bond_slashed: number }[];
  if (!rows[0]) return { slashed: 0, newBond: 0 };
  const { bond_amount, bond_slashed } = rows[0];
  const currentBond = bond_amount - bond_slashed;
  if (currentBond <= MIN_BOND) return { slashed: 0, newBond: currentBond };
  const slashAmt = Math.min(SLASH_AMOUNT, currentBond - MIN_BOND);
  await exec('UPDATE agents SET bond_slashed = bond_slashed + ?, avg_quality = MAX(0.1, avg_quality - 0.1) WHERE id = ?', [slashAmt, agentId]);
  await exec('INSERT INTO bond_slashes (id, agent_id, job_id, slash_amount, reason) VALUES (?, ?, ?, ?, ?)', [uuidv4(), agentId, jobId, slashAmt, reason]);
  return { slashed: slashAmt, newBond: currentBond - slashAmt };
}
