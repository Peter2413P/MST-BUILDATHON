import { chatComplete } from './llm';

interface AgentDef {
  skill: string;
  maxTokens: number;
  system: string;
  buildPrompt: (prompt: string, context: string) => string;
}

const AGENT_DEFS: AgentDef[] = [
  {
    skill: 'summarizer',
    maxTokens: 1024,
    system: 'Summarize the input concisely, preserving key facts, numbers, and conclusions. Output the summary only.',
    buildPrompt: (p, ctx) => ctx ? `Previous context:\n${ctx}\n\nSummarize:\n${p}` : `Summarize:\n${p}`,
  },
  {
    skill: 'code-review',
    maxTokens: 1536,
    system: 'Review code for bugs, security issues, and style problems. Output numbered findings: severity (critical/major/minor), description, suggested fix.',
    buildPrompt: (p, ctx) => {
      if (!ctx) return p;
      let code = ctx;
      if (code.length > 8000) {
        try {
          const raw = ctx.includes('### Context') ? ctx.slice(ctx.indexOf('\n') + 1) : ctx;
          const parsed = JSON.parse(raw);
          if (parsed.files && Array.isArray(parsed.files)) {
            code = parsed.files.slice(0, 5).map((f: any) => `// File: ${f.path}\n${f.content}`).join('\n\n');
            if (code.length > 8000) code = code.slice(0, 8000) + '\n\n...[truncated for review]';
          } else {
            code = code.slice(0, 8000) + '\n\n...[truncated]';
          }
        } catch {
          code = code.slice(0, 8000) + '\n\n...[truncated]';
        }
      }
      return `${p}\n\nCode:\n${code}`;
    },
  },
  {
    skill: 'research',
    maxTokens: 2048,
    system: 'Research the topic and produce a report: Overview, Key Findings, Data Points, Conclusion. Cite sources as [Source: description].',
    buildPrompt: (p, ctx) => ctx ? `${p}\n\nBackground:\n${ctx}` : p,
  },
  {
    skill: 'translate',
    maxTokens: 1024,
    system: 'Translate the input accurately, preserving tone and formatting. If target language is given as [to: Language], use it. Output translated text only.',
    buildPrompt: (p, ctx) => ctx ? `${p}\n\nText:\n${ctx}` : p,
  },
  {
    skill: 'sentiment',
    maxTokens: 512,
    system: 'Analyze sentiment. Output valid JSON only: {"overall":"positive|negative|neutral","score":<-1 to 1>,"emotions":[...],"confidence":<0-1>,"reasoning":"..."}',
    buildPrompt: (p, ctx) => ctx ? `Analyze sentiment of:\n${ctx}` : `Analyze sentiment of:\n${p}`,
  },
  {
    skill: 'sql',
    maxTokens: 1024,
    system: 'Convert natural language to valid PostgreSQL. Output: 1) SQL in a code block, 2) brief explanation, 3) assumptions.',
    buildPrompt: (p, ctx) => ctx ? `Schema:\n${ctx}\n\nGenerate SQL for:\n${p}` : `Generate SQL for:\n${p}`,
  },
  {
    skill: 'chart',
    maxTokens: 1536,
    system: 'Convert data to Chart.js config JSON. Output valid JSON only matching: {"type": "bar"|"line"|"pie"|"doughnut", "data": {"labels": [...], "datasets": [{"label": "...", "data": [...]}]}, "options": {"responsive": true, "plugins": {"title": {"display": true, "text": "..."}}}}.',
    buildPrompt: (p, ctx) => ctx ? `Data:\n${ctx}\n\nCreate chart for:\n${p}` : `Create chart for:\n${p}`,
  },
  {
    skill: 'extract',
    maxTokens: 1536,
    system: 'Extract entities, dates, numbers, and key-value pairs from text. Output valid JSON with all extracted data.',
    buildPrompt: (p, ctx) => ctx ? `${p}\n\nSource text:\n${ctx}` : p,
  },
  {
    skill: 'legal-review',
    maxTokens: 1536,
    system: 'Identify risky clauses: unlimited liability, one-sided termination, IP assignment, non-compete, auto-renewal. For each: quote the clause, name the risk type, rate severity (high/medium/low), explain in plain English.',
    buildPrompt: (p, ctx) => ctx ? `Review for risky clauses:\n\n${ctx}` : `Review for risky clauses:\n\n${p}`,
  },
  {
    skill: 'finance',
    maxTokens: 1536,
    system: 'Analyze the financials. Produce: Executive Summary, Key Metrics (table), Risk Factors, Recommendation.',
    buildPrompt: (p, ctx) => ctx ? `Prior research:\n${ctx}\n\nTask:\n${p}` : p,
  },
  {
    skill: 'transcribe',
    maxTokens: 1024,
    system: 'Clean up and format the transcript. Add speaker labels (Speaker A:, Speaker B:) where applicable. Remove filler words.',
    buildPrompt: (p, ctx) => ctx ? `Process:\n${p}\n\nContent:\n${ctx}` : `Process:\n${p}`,
  },
  {
    skill: 'fact-check',
    maxTokens: 1024,
    system: 'Fact-check each claim. Output a JSON array: [{"claim":"...","verdict":"true|false|partially-true|unverifiable","confidence":<0-1>,"explanation":"...","caveats":"..."}]',
    buildPrompt: (p, ctx) => ctx ? `Fact-check:\n${p}\n\nSource:\n${ctx}` : `Fact-check:\n${p}`,
  },
  {
    skill: 'ecommerce-builder',
    maxTokens: 3000,
    system: 'Autonomous agent that plans, designs, builds, tests, debugs, and delivers production-ready e-commerce websites.',
    buildPrompt: (p, ctx) => ctx ? `Context:\n${ctx}\n\nBuild e-commerce store for:\n${p}` : p,
  },
  {
    skill: 'shopping',
    maxTokens: 3500,
    system: 'Autonomous product discovery, price comparison, review analysis, and transparent recommendation agent.',
    buildPrompt: (p, ctx) => ctx ? `Context:\n${ctx}\n\nShopping task:\n${p}` : p,
  },
  {
    skill: 'product-discovery',
    maxTokens: 2048,
    system: 'Discover real products across connected catalog feeds without hallucination.',
    buildPrompt: (p, ctx) => ctx ? `Context:\n${ctx}\n\nSearch products:\n${p}` : p,
  },
  {
    skill: 'price-comparison',
    maxTokens: 1536,
    system: 'Deduplicate products and compare prices across multiple retailers.',
    buildPrompt: (p, ctx) => ctx ? `Context:\n${ctx}\n\nCompare prices:\n${p}` : p,
  },
  {
    skill: 'review-analysis',
    maxTokens: 1536,
    system: 'Analyze real user reviews, volume reliability, sentiment, positives, and drawbacks.',
    buildPrompt: (p, ctx) => ctx ? `Context:\n${ctx}\n\nAnalyze reviews:\n${p}` : p,
  },
  {
    skill: 'product-ranking',
    maxTokens: 2048,
    system: 'Deterministically filter hard constraints and rank products with transparent multi-criteria scoring.',
    buildPrompt: (p, ctx) => ctx ? `Context:\n${ctx}\n\nRank products:\n${p}` : p,
  },
];

const AGENT_BY_SKILL = Object.fromEntries(AGENT_DEFS.map(a => [a.skill, a]));

// Error phrases that signal the model couldn't fulfill the request
const REFUSAL_PATTERNS = [
  /i('m| am) (sorry|unable|not able)/i,
  /i (cannot|can't|couldn't|don't have (access|the ability))/i,
  /as an? (ai|language model|llm)/i,
  /i do not have (access|the ability|real.time)/i,
  /no (audio|image|file|attachment) (was |is )?provided/i,
];

function computeQualityScore(result: string, tokensUsed: number, elapsedMs: number, skill?: string): number {
  if (!result || result.trim().length === 0) return 0.1;

  let baseScore = 0.75;
  if (result.length >= 100) {
    baseScore = Math.min(0.95, 0.5 + Math.log10(Math.max(1, result.length / 100)) * 0.35);
  } else if (skill === 'finance' || skill === 'extract' || skill === 'sentiment' || skill === 'sql') {
    baseScore = 0.85;
  }

  // Structured output bonus: JSON, markdown headers, bullet points, math formula
  const hasStructure = /```|^#{1,3} |\*\*|\|.*\||\[.*\][\s\S]*{|\%|\=|\+|\-|\*|\//m.test(result);
  const structureBonus = hasStructure ? 0.05 : 0;

  // Latency penalty: > 35s suggests problems
  const latencyPenalty = elapsedMs > 35000 ? -0.1 : 0;

  // Refusal penalty: model said it couldn't do the task
  const refusalPenalty = REFUSAL_PATTERNS.some(p => p.test(result)) ? -0.35 : 0;

  return Math.min(1.0, Math.max(0.1, parseFloat((baseScore + structureBonus + latencyPenalty + refusalPenalty).toFixed(2))));
}

export async function runAgentInline(
  skill: string,
  prompt: string,
  context: string
): Promise<{ result: string; tokensUsed: number; qualityScore: number; servedBy: string }> {
  const def = AGENT_BY_SKILL[skill];
  if (!def) throw new Error(`Unknown skill: ${skill}`);

  // Route specialized autonomous workflow for ecommerce builder
  if (skill === 'ecommerce-builder') {
    const { executeEcommerceBuilder } = await import('./ecommerce/orchestrator');
    const start = Date.now();
    const buildArtifact = await executeEcommerceBuilder(prompt, context);
    const result = JSON.stringify(buildArtifact, null, 2);
    const elapsed = Date.now() - start;
    const tokensUsed = 1200;
    const qualityScore = buildArtifact.status === 'success' ? 0.98 : 0.75;
    return { result, tokensUsed, qualityScore, servedBy: 'ECommerceWebsiteBuilderEngine' };
  }

  // Route specialized autonomous workflow for shopping recommendation agent
  if (skill === 'shopping') {
    const { executeShoppingWorkflow } = await import('./shopping/orchestrator');
    const start = Date.now();
    const shoppingArtifact = await executeShoppingWorkflow(prompt);
    const result = JSON.stringify(shoppingArtifact, null, 2);
    const elapsed = Date.now() - start;
    const tokensUsed = 1100;
    const qualityScore = shoppingArtifact.status === 'success' || shoppingArtifact.status === 'conflict' ? 0.98 : 0.75;
    return { result, tokensUsed, qualityScore, servedBy: 'ShoppingAgentAutonomousEngine' };
  }

  // Route specialized sub-agent for product discovery
  if (skill === 'product-discovery') {
    const { getProviderRegistry } = await import('./shopping/providers/registry');
    const { extractRequirementsDeterministically } = await import('./shopping/planner/extractor');
    const reqs = extractRequirementsDeterministically(prompt);
    const registry = getProviderRegistry();
    const discovery = await registry.discoverProducts({
      query: prompt,
      category: reqs.category,
      maxPrice: reqs.budget.maximum,
    });
    return {
      result: JSON.stringify(discovery, null, 2),
      tokensUsed: 400,
      qualityScore: discovery.products.length > 0 ? 0.95 : 0.8,
      servedBy: 'ProductDiscoverySpecialist',
    };
  }

  const userMessage = def.buildPrompt(prompt, context);
  const start = Date.now();

  const { text: result, servedBy, tokensUsed } = await chatComplete({
    system: def.system,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: def.maxTokens,
    label: skill,
  });

  const elapsed = Date.now() - start;
  const qualityScore = computeQualityScore(result, tokensUsed, elapsed, skill);
  return { result, tokensUsed, qualityScore, servedBy };
}
