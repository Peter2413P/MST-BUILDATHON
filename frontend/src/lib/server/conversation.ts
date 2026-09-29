import { chatComplete } from './llm';
import type { RouterContext, RouterOutput } from './router';

export interface ConversationResponse {
  text: string;
  tokensUsed: number;
}

/**
 * ConversationLLM service: Handles all conversational inquiries, follow-up explanations,
 * clarifications, and task status inquiries without executing agents or triggering payments.
 */
export async function handleConversation(
  context: RouterContext,
  routerOutput: RouterOutput
): Promise<ConversationResponse> {
  const currentMsg = (context.current_message || '').trim();
  const prevTask = context.previous_task;
  const recentMessages = context.recent_messages || [];

  const systemPrompt = `You are the Conversation Intelligence Assistant for AgentMesh — an autonomous AI agent orchestration platform on MST Blockchain.

ROLE & BEHAVIOR:
- Provide natural, helpful, clear, and accurate conversational responses.
- Explain past calculation steps, data insights, and previous task results clearly using the provided context.
- If the user asks why an agent or task failed, reference the error message and explain what happened constructively.
- If the user asks general questions about AgentMesh, MSTC tokens, agents, or available skills, explain them clearly.
- If the user's message is ambiguous (e.g. "Can you help me with this?"), ask clarifying questions to understand what they would like to do.

STRICT CONVERSATION BOUNDARIES:
- DO NOT claim to hire new agents, execute tasks, or create blockchain payments for this conversational turn.
- DO NOT invent or quote new MSTC charges for answering questions.
- Payment information must ONLY be mentioned if referencing actual past settled jobs and actual past transaction data from context.
- Keep responses concise, direct, and conversational.`;

  const contextSection = [
    prevTask
      ? `[PREVIOUS TASK CONTEXT]
- Job ID: ${prevTask.id || 'N/A'}
- Status: ${prevTask.status || 'unknown'}
- Description: ${prevTask.description || 'N/A'}
- Result: ${prevTask.result || 'None'}
- Error: ${prevTask.error || 'None'}
- Agents Involved: ${prevTask.agents_used ? prevTask.agents_used.join(', ') : 'None'}
- Settled MSTC: ${prevTask.settlement_mstc ? `${prevTask.settlement_mstc} MSTC` : 'None'}`
      : '[PREVIOUS TASK CONTEXT]: None',
    routerOutput.reason ? `[ROUTER REASONING]: ${routerOutput.reason}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const historyMessages = recentMessages.slice(-6).map(m => ({
    role: m.role,
    content: m.content,
  }));

  const messages = [
    ...historyMessages,
    {
      role: 'user',
      content: contextSection
        ? `${contextSection}\n\nUser Message: ${currentMsg}`
        : currentMsg,
    },
  ];

  try {
    const res = await chatComplete({
      messages,
      system: systemPrompt,
      maxTokens: 1024,
      label: 'ConversationLLM',
    });

    return {
      text: res.text.trim(),
      tokensUsed: res.tokensUsed || 0,
    };
  } catch (err) {
    console.error('[ConversationLLM] LLM error:', (err as Error).message);
    // Graceful fallback response
    if (prevTask?.error && /why.*fail/i.test(currentMsg)) {
      return {
        text: `The previous task encountered an issue: ${prevTask.error}. Please check the input requirements or try rephrasing your request.`,
        tokensUsed: 0,
      };
    }
    if (/help/i.test(currentMsg)) {
      return {
        text: 'I would be happy to help! Please tell me what you would like to analyze, calculate, research, or build.',
        tokensUsed: 0,
      };
    }
    return {
      text: 'I understand your message. How can I assist you with AgentMesh today?',
      tokensUsed: 0,
    };
  }
}
