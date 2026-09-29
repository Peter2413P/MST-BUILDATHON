export interface RequirementSpec {
  brand: string;
  tagline?: string;
  category: string;
  purpose: string;
  targetAudience: string;
  visualStyle: string;
  pages: string[];
  features: string[];
  components: string[];
  responsiveRequirements: string[];
  assumptions: string[];
}

export interface DesignSpec {
  colorPalette: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
    border: string;
  };
  typography: {
    fontFamily: string;
    headingScale: string;
    bodyScale: string;
  };
  layoutStructure: {
    containerWidth: string;
    gridColumns: number;
    spacingUnit: string;
  };
  componentSpecs: Array<{
    name: string;
    purpose: string;
    props?: Record<string, string>;
  }>;
}

export interface DesignRequest {
  requirements: RequirementSpec;
}

export interface DesignResult {
  success: boolean;
  designSpec: DesignSpec;
  provider: string;
  error?: string;
}

export interface DesignProvider {
  generateDesign(input: DesignRequest): Promise<DesignResult>;
}

export interface BuildPlan {
  steps: Array<{
    id: number;
    title: string;
    description: string;
    targetFiles: string[];
  }>;
}

export interface GeneratedFile {
  path: string;
  content: string;
  description?: string;
}

export interface BuildRequest {
  requirements: RequirementSpec;
  designSpec: DesignSpec;
  plan: BuildPlan;
  existingFiles?: GeneratedFile[];
  previousErrors?: string[];
}

export interface BuildResult {
  success: boolean;
  files: GeneratedFile[];
  provider: string;
  error?: string;
}

export interface BuildProvider {
  generateCode(input: BuildRequest): Promise<BuildResult>;
}

export interface ValidationIssue {
  filePath?: string;
  line?: number;
  message: string;
  severity: 'error' | 'warning';
  code?: string;
}

export interface ValidationResult {
  passed: boolean;
  workspacePath?: string;
  issues: ValidationIssue[];
  stdout?: string;
  stderr?: string;
}

export interface ValidationProvider {
  validate(files: GeneratedFile[], workspaceJobId?: string): Promise<ValidationResult>;
}

export interface DebugRequest {
  files: GeneratedFile[];
  requirements: RequirementSpec;
  designSpec: DesignSpec;
  validationIssues: ValidationIssue[];
  attemptNumber: number;
  maxAttempts: number;
}

export interface DebugResult {
  repaired: boolean;
  patchedFiles: GeneratedFile[];
  diagnosticSummary: string;
  fixesApplied: string[];
}

export interface DebugProvider {
  diagnoseAndRepair(request: DebugRequest): Promise<DebugResult>;
}

export interface WebsiteBuildResult {
  type: 'website';
  status: 'success' | 'failed' | 'building';
  name: string;
  brand: string;
  category: string;
  previewUrl?: string;
  sourceArtifact?: string;
  screenshots: string[];
  pages: Array<{ name: string; path: string; status: 'ready' | 'pending' | 'error' }>;
  buildStatus: 'passed' | 'failed' | 'skipped';
  debugAttempts: number;
  summary: string;
  files: GeneratedFile[];
  designSpec?: DesignSpec;
  requirements?: RequirementSpec;
  logs: string[];
}
