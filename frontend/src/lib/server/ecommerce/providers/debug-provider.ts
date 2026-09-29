import { chatComplete } from '../../llm';
import type { DebugProvider, DebugRequest, DebugResult, GeneratedFile } from '../types';

export class AutonomousDebugProvider implements DebugProvider {
  async diagnoseAndRepair(request: DebugRequest): Promise<DebugResult> {
    const { files, validationIssues, attemptNumber, maxAttempts } = request;
    const fixesApplied: string[] = [];
    const patchedFiles: GeneratedFile[] = [...files];

    if (attemptNumber > maxAttempts) {
      return {
        repaired: false,
        patchedFiles: files,
        diagnosticSummary: `Exceeded maximum auto-repair retry attempts (${maxAttempts}).`,
        fixesApplied,
      };
    }

    // Process each validation error
    for (const issue of validationIssues) {
      if (!issue.filePath) continue;

      const fileIndex = patchedFiles.findIndex(f => f.path === issue.filePath);
      if (fileIndex === -1) continue;

      const currentFile = patchedFiles[fileIndex];

      // Handle common issues deterministically or via LLM repair
      if (issue.code === 'SYNTAX_UNBALANCED_BRACES') {
        // Balance missing braces
        let depth = 0;
        for (const char of currentFile.content) {
          if (char === '{') depth++;
          if (char === '}') depth--;
        }

        if (depth > 0) {
          currentFile.content = currentFile.content + '\n' + '}'.repeat(depth);
          fixesApplied.push(`Balanced ${depth} unclosed brace(s) in ${issue.filePath}`);
        }
      } else if (issue.code === 'INVALID_JSON') {
        try {
          const sanitized = currentFile.content.replace(/,\s*([\}\]])/g, '$1');
          JSON.parse(sanitized);
          currentFile.content = sanitized;
          fixesApplied.push(`Sanitized trailing commas in JSON file ${issue.filePath}`);
        } catch {
          // LLM JSON fix
          try {
            const { text } = await chatComplete({
              system: 'Fix this invalid JSON and return ONLY the valid JSON object.',
              messages: [{ role: 'user', content: currentFile.content }],
              maxTokens: 1000,
              label: 'JsonDebugger',
            });
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              currentFile.content = jsonMatch[0];
              fixesApplied.push(`Repaired JSON schema in ${issue.filePath}`);
            }
          } catch {
            /* ignore */
          }
        }
      } else {
        // General TypeScript / React error repair via LLM debugger
        try {
          const { text } = await chatComplete({
            system: `You are an expert TypeScript / Next.js compiler debugger.
The following file has an error: "${issue.message}".
Fix the error and output ONLY the complete corrected file content. Do not include markdown code block markers.`,
            messages: [
              {
                role: 'user',
                content: `File Path: ${currentFile.path}\nError: ${issue.message}\n\nFile Content:\n${currentFile.content}`,
              },
            ],
            maxTokens: 2000,
            label: 'CodeDebugger',
          });

          const cleaned = text.replace(/^```[a-z]*\n?/i, '').replace(/```\n?$/i, '').trim();
          if (cleaned.length > 20) {
            currentFile.content = cleaned;
            fixesApplied.push(`Patched compiler issue in ${issue.filePath}: ${issue.message}`);
          }
        } catch (llmErr) {
          console.warn(`[DebugProvider] LLM patch failed for ${issue.filePath}:`, (llmErr as Error).message);
        }
      }
    }

    return {
      repaired: fixesApplied.length > 0,
      patchedFiles,
      diagnosticSummary: `Debug iteration ${attemptNumber}/${maxAttempts}: Applied ${fixesApplied.length} automatic patches.`,
      fixesApplied,
    };
  }
}
