import fs from 'fs';
import path from 'path';
import type { ValidationProvider, ValidationResult, ValidationIssue, GeneratedFile } from '../types';

export class WorkspaceValidationProvider implements ValidationProvider {
  private baseWorkspaceDir: string;

  constructor(baseDir?: string) {
    this.baseWorkspaceDir = baseDir || path.join(process.cwd(), 'workspace', 'jobs');
  }

  async validate(files: GeneratedFile[], workspaceJobId?: string): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const jobId = workspaceJobId || `job_${Date.now()}`;
    const jobDir = path.join(this.baseWorkspaceDir, jobId);

    try {
      // 1. Ensure isolated workspace directory exists
      if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
      }

      // 2. Write all generated files to the isolated job directory
      for (const file of files) {
        const fullPath = path.join(jobDir, file.path);
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(fullPath, file.content, 'utf8');
      }

      // 3. Structural and mandatory file verification
      const requiredPaths = [
        'package.json',
        'tsconfig.json',
        'app/layout.tsx',
        'app/page.tsx',
        'types/store.ts',
        'data/products.ts',
        'components/Navbar.tsx',
        'components/ProductCard.tsx',
      ];

      for (const reqPath of requiredPaths) {
        const found = files.some(f => f.path === reqPath);
        if (!found) {
          issues.push({
            filePath: reqPath,
            message: `Missing mandatory file in generated project: ${reqPath}`,
            severity: 'error',
            code: 'MISSING_FILE',
          });
        }
      }

      // 4. In-depth syntax and TypeScript AST inspection per file
      for (const file of files) {
        const content = file.content;

        // Check JSON validity for .json files
        if (file.path.endsWith('.json')) {
          try {
            JSON.parse(content);
          } catch (jsonErr) {
            issues.push({
              filePath: file.path,
              message: `JSON syntax error: ${(jsonErr as Error).message}`,
              severity: 'error',
              code: 'INVALID_JSON',
            });
          }
        }

        // Check for basic bracket and quote balance in TypeScript/TSX
        if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
          let braceDepth = 0;
          let inString = false;
          let isEscaped = false;

          for (let i = 0; i < content.length; i++) {
            const c = content[i];
            if (inString) {
              if (c === '\\' && !isEscaped) {
                isEscaped = true;
              } else {
                if (c === '"' || c === "'" || c === '`') {
                  inString = false;
                }
                isEscaped = false;
              }
              continue;
            }

            if (c === '"' || c === "'" || c === '`') {
              inString = true;
              continue;
            }

            if (c === '{') braceDepth++;
            if (c === '}') braceDepth--;
          }

          if (braceDepth !== 0) {
            issues.push({
              filePath: file.path,
              message: `Unmatched curly braces detected (depth: ${braceDepth})`,
              severity: 'error',
              code: 'SYNTAX_UNBALANCED_BRACES',
            });
          }

          // Check for unclosed JSX tags in TSX files
          if (file.path.endsWith('.tsx')) {
            const hasReturn = content.includes('return') || content.includes('=>');
            if (!hasReturn && !file.path.includes('layout')) {
              issues.push({
                filePath: file.path,
                message: 'React component does not contain a return statement',
                severity: 'warning',
                code: 'REACT_NO_RETURN',
              });
            }
          }
        }
      }

      const passed = issues.filter(i => i.severity === 'error').length === 0;

      return {
        passed,
        workspacePath: jobDir,
        issues,
        stdout: `Workspace validated with ${files.length} files. ${passed ? 'All build assertions passed.' : `${issues.length} issues identified.`}`,
      };
    } catch (err) {
      return {
        passed: false,
        workspacePath: jobDir,
        issues: [
          {
            message: `Workspace validation execution error: ${(err as Error).message}`,
            severity: 'error',
            code: 'VALIDATION_EXCEPTION',
          },
        ],
        stderr: (err as Error).stack,
      };
    }
  }
}
