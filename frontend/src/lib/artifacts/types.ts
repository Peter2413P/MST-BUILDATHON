export type ArtifactType =
  | 'text'
  | 'markdown'
  | 'chart'
  | 'image'
  | 'pdf'
  | 'html'
  | 'code'
  | 'table'
  | 'json'
  | 'fact_check';

export interface ChartDataset {
  label?: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

export interface ChartSpec {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'area';
  data: {
    labels: string[];
    datasets: ChartDataset[];
  };
  options?: {
    title?: { display?: boolean; text?: string };
    responsive?: boolean;
    scales?: Record<string, unknown>;
    plugins?: Record<string, unknown>;
  };
}

export interface TableSpec {
  columns: string[];
  rows: (string | number)[][];
  title?: string;
}

export interface CodeSpec {
  language: string;
  code: string;
  filename?: string;
}

export interface FactCheckItem {
  claim: string;
  verdict: 'true' | 'false' | 'uncertain' | 'partially-true' | 'unverifiable' | string;
  confidence?: number;
  explanation: string;
  caveats?: string;
}

export interface FactCheckSpec {
  type: 'fact_check';
  title?: string;
  items: FactCheckItem[];
}

export interface NormalizedArtifact {
  artifactId: string;
  type: ArtifactType;
  title: string;
  description?: string;
  mimeType: string;
  rawContent: string;
  data?: ChartSpec | TableSpec | CodeSpec | FactCheckSpec | string | Record<string, unknown>;
  sourceAgent?: string;
  status: 'completed' | 'failed' | 'processing';
  error?: string;
}

export interface MultiArtifactComposite {
  narrative?: string;
  artifacts: NormalizedArtifact[];
}
