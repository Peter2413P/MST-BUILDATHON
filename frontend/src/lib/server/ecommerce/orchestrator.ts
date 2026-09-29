import { PlannerProvider } from './providers/planner-provider';
import { ExtensibleDesignProvider } from './providers/design-provider';
import { NextjsBuildProvider } from './providers/build-provider';
import { WorkspaceValidationProvider } from './providers/validation-provider';
import { AutonomousDebugProvider } from './providers/debug-provider';
import type { WebsiteBuildResult, GeneratedFile } from './types';

export async function executeEcommerceBuilder(
  prompt: string,
  context?: string,
  jobId?: string
): Promise<WebsiteBuildResult> {
  const logs: string[] = [];
  const activeJobId = jobId || `ecom_${Date.now()}`;

  const logStep = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(`[ECommerceWebsiteBuilder] ${msg}`);
  };

  logStep('Stage 1: Requirement Analysis & Domain Modeling');
  const planner = new PlannerProvider();
  const requirements = await planner.analyzeRequirements(prompt, context);
  logStep(`Parsed brand "${requirements.brand}" in category "${requirements.category}" with ${requirements.pages.length} pages`);

  logStep('Stage 2: Architecture & Build Planning');
  const plan = planner.createBuildPlan(requirements);
  logStep(`Constructed build plan with ${plan.steps.length} sequential execution stages`);

  logStep('Stage 3: Design System & Visual Token Generation');
  const designProvider = new ExtensibleDesignProvider();
  const designResult = await designProvider.generateDesign({ requirements });
  logStep(`Design system generated via ${designResult.provider} (Palette: ${designResult.designSpec.colorPalette.primary})`);

  logStep('Stage 4: Multi-File Next.js Application Generation');
  const buildProvider = new NextjsBuildProvider();
  const buildResult = await buildProvider.generateCode({
    requirements,
    designSpec: designResult.designSpec,
    plan,
  });
  let currentFiles: GeneratedFile[] = buildResult.files;
  logStep(`Generated ${currentFiles.length} application files across app/, components/, and data/`);

  logStep('Stage 5: Isolated Workspace Build Validation');
  const validationProvider = new WorkspaceValidationProvider();
  let validationResult = await validationProvider.validate(currentFiles, activeJobId);

  let debugAttempts = 0;
  const maxDebugAttempts = 3;

  // Stage 6: Autonomous Debugging if errors found
  if (!validationResult.passed) {
    logStep(`Build validation detected ${validationResult.issues.length} issue(s). Initiating Autonomous Debugger...`);
    const debugProvider = new AutonomousDebugProvider();

    while (!validationResult.passed && debugAttempts < maxDebugAttempts) {
      debugAttempts++;
      logStep(`Debug Attempt ${debugAttempts}/${maxDebugAttempts}...`);

      const debugResult = await debugProvider.diagnoseAndRepair({
        files: currentFiles,
        requirements,
        designSpec: designResult.designSpec,
        validationIssues: validationResult.issues,
        attemptNumber: debugAttempts,
        maxAttempts: maxDebugAttempts,
      });

      currentFiles = debugResult.patchedFiles;
      logStep(debugResult.diagnosticSummary);

      validationResult = await validationProvider.validate(currentFiles, activeJobId);
      if (validationResult.passed) {
        logStep('✓ Build validation passed after auto-patching!');
        break;
      }
    }
  } else {
    logStep('✓ Build validation passed with 0 errors on first attempt.');
  }

  // Stage 7: Deliverable Assembly
  const pagesList = requirements.pages.map(pageName => {
    const slug = pageName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const path = slug === 'home' ? '/' : `/${slug}`;
    return {
      name: pageName,
      path,
      status: 'ready' as const,
    };
  });

  const buildStatus = validationResult.passed ? ('passed' as const) : ('failed' as const);

  const result: WebsiteBuildResult = {
    type: 'website',
    status: validationResult.passed ? 'success' : 'failed',
    name: `${requirements.brand} E-Commerce Store`,
    brand: requirements.brand,
    category: requirements.category,
    previewUrl: `/workspace/jobs/${activeJobId}/preview`,
    sourceArtifact: `agentguild://${activeJobId}/source.zip`,
    screenshots: [],
    pages: pagesList,
    buildStatus,
    debugAttempts,
    summary: `Autonomous website build completed for ${requirements.brand}. Generated ${currentFiles.length} files across Next.js 14 App Router with responsive Tailwind styling, Cart context, Product filtering, and Express Checkout.`,
    files: currentFiles,
    designSpec: designResult.designSpec,
    requirements,
    logs,
  };

  return result;
}
