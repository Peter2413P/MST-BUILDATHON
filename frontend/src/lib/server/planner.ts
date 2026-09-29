import { chatComplete } from './llm';

const SKILLS = [
  'summarizer', 'code-review', 'research', 'translate',
  'sentiment', 'sql', 'chart', 'extract',
  'legal-review', 'finance', 'transcribe', 'fact-check',
  'ecommerce-builder', 'shopping', 'product-discovery',
  'price-comparison', 'review-analysis', 'product-ranking',
];

export interface SubtaskPlan {
  id?: string;
  skill: string;
  prompt: string;
  dependencies?: string[];
  optional?: boolean;
  complexity_weight: number;
  position: number;
}

export interface Plan {
  subtasks: SubtaskPlan[];
  reasoning: string;
}

interface AgentRow { skill: string; name: string; description: string; price_usdc: number }

export async function decomposeJob(description: string, agents: AgentRow[]): Promise<Plan> {
  const agentList = agents
    .map(a => `- ${a.skill} (${a.name}): ${a.description} @ $${a.price_usdc}`)
    .join('\n');

  try {
    const { text, servedBy } = await chatComplete({
      maxTokens: 1536,
      label: 'Planner',
      messages: [{
        role: 'user',
        content: `You are AgentGuild's autonomous task orchestration planner.
Decompose the following job into a directed acyclic task graph (DAG) of subtasks, assigning each to the best-fit agent skill and explicitly defining its prerequisite dependencies.

Job: "${description}"

Available agents:
${agentList}

Return ONLY valid JSON (no markdown) matching this schema exactly:
{
  "subtasks": [
    {
      "id": "task_1",
      "skill": "<skill-from-list>",
      "prompt": "<specific actionable instructions for this agent>",
      "dependencies": [],
      "optional": false,
      "complexity_weight": <float 0.5-3.0>,
      "position": 1
    },
    {
      "id": "task_2",
      "skill": "<skill-from-list>",
      "prompt": "<specific instructions building on task_1>",
      "dependencies": ["task_1"],
      "optional": false,
      "complexity_weight": <float 0.5-3.0>,
      "position": 2
    }
  ],
  "reasoning": "<one sentence explaining the workflow and dependency graph>"
}

Rules:
- Use only skills from: ${SKILLS.join(', ')}
- 1-5 subtasks. Use exactly 1 subtask if a single agent can fully handle the job.
- "id": Unique string identifier (e.g. "task_1", "task_2", "task_3").
- "dependencies": Array of prerequisite task IDs that MUST complete successfully before this task can run (e.g. [] for root tasks, ["task_1"] for dependent tasks). Parallel tasks may share a parent without depending on each other.
- "optional": Boolean (false for mandatory tasks, true if failure should allow partial success).
- complexity_weight: 0.5=trivial, 1.0=normal, 2.0=hard, 3.0=expert.
- prompts must be specific and actionable.`,
      }],
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleaned = jsonMatch ? jsonMatch[0] : text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const plan = JSON.parse(cleaned) as Plan;

    // Normalize IDs and dependencies
    plan.subtasks = plan.subtasks.map((st, idx) => {
      const defaultId = `task_${idx + 1}`;
      const id = st.id || defaultId;
      const deps = Array.isArray(st.dependencies)
        ? st.dependencies.map(d => String(d))
        : idx > 0 ? [`task_${idx}`] : [];
      return {
        ...st,
        id,
        dependencies: deps,
        optional: Boolean(st.optional),
        position: st.position || (idx + 1),
        complexity_weight: typeof st.complexity_weight === 'number' ? st.complexity_weight : 1.0,
      };
    });

    console.log(`[Planner] ${plan.subtasks.length} subtasks via ${servedBy}: ${plan.reasoning}`);
    return plan;
  } catch (err) {
    console.error('[Planner] Decomposition failed, using intelligent fallback:', (err as Error).message);

    const lower = description.toLowerCase();

    // 1. E-Commerce Website Builder matching
    if (
      lower.includes('e-commerce') ||
      lower.includes('ecommerce') ||
      lower.includes('website') ||
      lower.includes('storefront') ||
      lower.includes('fashion brand') ||
      lower.includes('online store') ||
      lower.includes('next.js store') ||
      lower.includes('checkout')
    ) {
      return {
        subtasks: [
          {
            id: 'task_1',
            skill: 'ecommerce-builder',
            prompt: description,
            dependencies: [],
            optional: false,
            complexity_weight: 2.5,
            position: 1,
          },
        ],
        reasoning: 'Domain match: E-Commerce Website Builder Agent for end-to-end storefront design and generation.',
      };
    }

    // 2. Fact Check matching
    if (lower.includes('fact-check') || lower.includes('fact check') || lower.includes('verify claims')) {
      return {
        subtasks: [
          {
            id: 'task_1',
            skill: 'fact-check',
            prompt: description,
            dependencies: [],
            optional: false,
            complexity_weight: 1.2,
            position: 1,
          },
        ],
        reasoning: 'Domain match: Fact Check Agent for claim verification.',
      };
    }

    // 3. Chart & Visual matching
    if (lower.includes('chart') || lower.includes('plot') || lower.includes('graph')) {
      return {
        subtasks: [
          { id: 'task_1', skill: 'finance', prompt: `Analyze and calculate: ${description}`, dependencies: [], optional: false, complexity_weight: 1.0, position: 1 },
          { id: 'task_2', skill: 'chart', prompt: `Generate chart for: ${description}`, dependencies: ['task_1'], optional: false, complexity_weight: 1.0, position: 2 },
        ],
        reasoning: 'Domain match: Finance calculation (task_1) then Chart visualization (task_2).',
      };
    }

    // 4. Shopping & Product Discovery / Comparison matching
    if (
      !lower.includes('build') &&
      !lower.includes('website') &&
      !lower.includes('storefront') &&
      (
        lower.includes('laptop') ||
        lower.includes('phone') ||
        lower.includes('shoes') ||
        lower.includes('running shoe') ||
        lower.includes('monitor') ||
        lower.includes('rtx') ||
        lower.includes('under ₹') ||
        lower.includes('under rs') ||
        lower.includes('under $') ||
        lower.includes('find me the best') ||
        lower.includes('find an') ||
        lower.includes('find running') ||
        lower.includes('compare the best') ||
        lower.includes('compare these') ||
        lower.includes('buy a') ||
        lower.includes('recommend a')
      )
    ) {
      return {
        subtasks: [
          {
            id: 'task_1',
            skill: 'shopping',
            prompt: description,
            dependencies: [],
            optional: false,
            complexity_weight: 1.5,
            position: 1,
          },
        ],
        reasoning: 'Domain match: Shopping Agent for autonomous product discovery, price comparison, review analysis, and recommendation.',
      };
    }

    // Default Fallback
    return {
      subtasks: [
        { id: 'task_1', skill: 'research', prompt: `Research: ${description}`, dependencies: [], optional: false, complexity_weight: 1.5, position: 1 },
        { id: 'task_2', skill: 'summarizer', prompt: `Summarize the findings for: ${description}`, dependencies: ['task_1'], optional: false, complexity_weight: 1.0, position: 2 },
      ],
      reasoning: 'Fallback: research (task_1) then summarize (task_2).',
    };
  }
}
