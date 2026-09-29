import { chatComplete } from './llm';

export interface RouterContext {
  current_message: string;
  recent_messages?: { role: 'user' | 'assistant'; content: string; timestamp?: string }[];
  previous_task?: {
    id?: string;
    status?: string;
    description?: string;
    result?: string | null;
    error?: string | null;
    artifacts?: unknown[];
    agents_used?: string[];
    settlement_mstc?: number;
  } | null;
  wallet?: {
    address?: string | null;
    authenticated?: boolean;
  } | null;
}

export interface RouterOutput {
  intent: 'conversation' | 'task';
  confidence: number;
  reason: string;
  requires_execution: boolean;
  requires_payment: boolean;
  task_summary: string | null;
  context_required: boolean;
}

const AVAILABLE_SKILLS = [
  'summarizer (text/document summarization)',
  'code-review (code analysis, security, bug fixes)',
  'research (web/domain deep research with citations)',
  'translate (language translation)',
  'sentiment (emotion/sentiment tagging)',
  'sql (natural language to database queries)',
  'chart (data visualization & chart generation)',
  'extract (structured entity/data extraction)',
  'legal-review (contract clause risk analysis)',
  'finance (financial metrics, valuation, forecasting)',
  'transcribe (audio speech-to-text)',
  'fact-check (claim verification)',
  'ecommerce-builder (web/app generation)',
  'shopping (product discovery, price comparison, review analysis, and recommendations)',
];

/**
 * Deterministic fallback classifier when LLM is unreachable.
 */
function deterministicFallbackClassifier(context: RouterContext): RouterOutput {
  const msg = (context.current_message || '').trim().toLowerCase();
  const prevTask = context.previous_task;

  // Obvious conversation patterns (questions, inquiries, opinions)
  const conversationQuestions = [
    /^(what|why|how|who|where|when|can you explain|explain|tell me about|just tell me|tell me|which|is it|are you|should i|do you think)\b/i,
    /^(hello|hi|hey|greetings|thanks|thank you|good morning|good evening)\b/i,
    /\b(mean|meaning|explain|explanation|clarify|clarification|why did|how did|how much cost|cost of|what agents|available agents|about mst|about mstc)\b/i,
    /\b(why.*fail|why.*error|why.*broken|what happened)\b/i,
    /\b(what gpu is good|which gpu is best|what is a good|is rtx.*good for)\b/i,
  ];

  // Explicit execution action verbs
  const explicitTaskVerbs = [
    /^(calculate|compute|analyze|extract|build|create|generate|translate|transcribe|research|review|check|verify|write sql|plot|make a chart|run|retry|do the same|do it again)\b/i,
    /^(find|search for|compare|recommend|shop for|i need|get me|no \w+ over)\b/i,
    /\b(create a chart|make a chart|generate a chart|plot this|draw a chart|create a pie chart|create a bar chart)\b/i,
    /\b(translate (this|it|the result) to|translate to)\b/i,
    /\b(retry (the|with)|calculate.*again|run.*again|do.*again|do the same task)\b/i,
    /\b(build (me )?an?|develop|code a|write code for)\b/i,
    /\b(extract (the|from)|scrape|parse)\b/i,
    /\b(find (me )?a|find (me )?the best|find an|compare the best|compare these|laptop under|phone under|shoes under|monitors? under)\b/i,
  ];

  // Ambiguous phrasing
  if (/^(can you help me with this|can you do something with this|help me with this)\b/i.test(msg)) {
    return {
      intent: 'conversation',
      confidence: 0.85,
      reason: 'Ambiguous request without explicit task instructions. Asking user for clarification.',
      requires_execution: false,
      requires_payment: false,
      task_summary: null,
      context_required: true,
    };
  }

  // Check if message is a question seeking explanation
  const isQuestion = conversationQuestions.some(p => p.test(msg));
  const isTask = explicitTaskVerbs.some(p => p.test(msg));

  if (isTask && !msg.startsWith('why') && !msg.startsWith('what does') && !msg.startsWith('how did')) {
    let taskSummary = context.current_message.trim();
    if (prevTask?.result && /\b(that|those numbers|those results|it|the result|same data)\b/i.test(taskSummary)) {
      taskSummary = `${taskSummary} [Context: ${prevTask.result.slice(0, 200)}]`;
    }
    return {
      intent: 'task',
      confidence: 0.9,
      reason: 'Explicit actionable task verb detected.',
      requires_execution: true,
      requires_payment: true,
      task_summary: taskSummary,
      context_required: Boolean(prevTask),
    };
  }

  if (isQuestion) {
    return {
      intent: 'conversation',
      confidence: 0.92,
      reason: 'Inquiry or explanation request that does not require agent execution.',
      requires_execution: false,
      requires_payment: false,
      task_summary: null,
      context_required: Boolean(prevTask || (context.recent_messages && context.recent_messages.length > 0)),
    };
  }

  // Default conservative fallback: CONVERSATION
  return {
    intent: 'conversation',
    confidence: 0.75,
    reason: 'Conservative fallback: Ambiguous input classified as conversation to prevent accidental MSTC expenditure.',
    requires_execution: false,
    requires_payment: false,
    task_summary: null,
    context_required: false,
  };
}

/**
 * Route incoming user messages through the Conversation Intelligence Router.
 */
export async function routeMessage(context: RouterContext): Promise<RouterOutput> {
  const currentMsg = (context.current_message || '').trim();
  if (!currentMsg) {
    return {
      intent: 'conversation',
      confidence: 1.0,
      reason: 'Empty message received.',
      requires_execution: false,
      requires_payment: false,
      task_summary: null,
      context_required: false,
    };
  }

  const prompt = `You are the Conversation Intelligence Router for AgentMesh, an autonomous multi-agent decentralized orchestration platform.

YOUR RESPONSIBILITY:
Determine whether the user's message is a CONVERSATION inquiry or a TASK requiring specialized agent execution.

Available Specialized Agent Capabilities:
${AVAILABLE_SKILLS.map(s => `- ${s}`).join('\n')}

CLASSIFICATION RULES:

1. CONVERSATION:
   - General questions, greetings, conceptual questions ("What is revenue growth?", "What is 20%?", "What is MSTC?").
   - Follow-up questions about previous results/calculations ("Why is that 40%?", "How did you calculate that?", "What does that mean?", "Can you explain the result?").
   - Inquiries about system, agents, or payment ("What agents are available?", "How much did my previous task cost?", "Why was payment not processed?").
   - Questions about failures ("Why did the FinanceAgent fail?", "Why did that task fail?").
   - Ambiguous or underspecified requests ("Can you help me with this?", "Can you do something with this data?") -> MUST be CONVERSATION to ask clarification without spending funds.
   - For CONVERSATION:
     "intent": "conversation",
     "requires_execution": false,
     "requires_payment": false,
     "task_summary": null

2. TASK:
   - Requests with explicit execution intent that require specialized agents ("Calculate 20% of ₹500", "Analyze this dataset", "Analyze this data", "Extract revenue from document", "Build an e-commerce website", "Translate this document to Tamil"). Note: "Analyze this dataset" has explicit action intent and MUST be classified as a TASK.
   - Follow-up requests that explicitly command new work ("Create a chart for that", "Now translate it to Tamil", "Retry the calculation with Q3 included", "Do the same task again", "Use the same data but create a pie chart").
   - When referencing previous data ("that", "it", "those numbers"), resolve and incorporate the previous task context into "task_summary".
   - For TASK:
     "intent": "task",
     "requires_execution": true,
     "requires_payment": true,
     "task_summary": "<normalized, unambiguous actionable task description>"

CONVERSATION CONTEXT:
- Current Message: "${currentMsg}"
${context.recent_messages && context.recent_messages.length > 0 ? `- Recent History:\n${context.recent_messages.slice(-3).map(m => `  ${m.role}: ${m.content}`).join('\n')}` : '- Recent History: (none)'}
${context.previous_task ? `- Previous Task ID: ${context.previous_task.id || 'unknown'}
  - Previous Task Status: ${context.previous_task.status || 'unknown'}
  - Previous Task Description: ${context.previous_task.description || 'none'}
  - Previous Task Result: ${context.previous_task.result ? context.previous_task.result.slice(0, 300) : 'none'}
  - Previous Task Error: ${context.previous_task.error || 'none'}` : '- Previous Task: (none)'}
- Connected Wallet: ${context.wallet?.address ? `${context.wallet.address} (contextual only)` : 'none'}

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema exactly (no markdown, no preamble):
{
  "intent": "conversation" | "task",
  "confidence": <float 0.0-1.0>,
  "reason": "<short explanation>",
  "requires_execution": <boolean>,
  "requires_payment": <boolean>,
  "task_summary": "<string or null>",
  "context_required": <boolean>
}`;

  let output: RouterOutput;

  try {
    const { text } = await chatComplete({
      messages: [{ role: 'user', content: prompt }],
      system: 'You are a precise, conservative intent classification router. You never execute paid tasks for questions or explanations.',
      maxTokens: 512,
      label: 'ConversationRouter',
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleaned = jsonMatch ? jsonMatch[0] : text.trim();
    const parsed = JSON.parse(cleaned) as Partial<RouterOutput>;

    const isTask = parsed.intent === 'task' && parsed.requires_execution === true;

    output = {
      intent: isTask ? 'task' : 'conversation',
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.9,
      reason: parsed.reason || (isTask ? 'Actionable multi-agent task execution requested.' : 'Conversational inquiry.'),
      requires_execution: isTask,
      requires_payment: isTask,
      task_summary: isTask ? (parsed.task_summary || currentMsg) : null,
      context_required: Boolean(parsed.context_required),
    };
  } catch (err) {
    console.warn('[Router] LLM classification error, falling back to deterministic classifier:', (err as Error).message);
    output = deterministicFallbackClassifier(context);
  }

  // Mandatory AgentMesh Router Logging
  console.log(`[Router] message classified as ${output.intent.toUpperCase()}`);
  console.log(`[Router] confidence=${output.confidence.toFixed(2)}`);
  console.log(`[Router] forwarding ${output.intent.toUpperCase()} to ${output.intent === 'task' ? 'Planner' : 'ConversationLLM'}`);

  return output;
}
