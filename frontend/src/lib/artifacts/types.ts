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
  | 'fact_check'
  | 'website';

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

export interface WebsitePage {
  name: string;
  path: string;
  status: 'ready' | 'pending' | 'error';
}

export interface WebsiteFile {
  path: string;
  content: string;
  description?: string;
}

export interface WebsiteSpec {
  type: 'website';
  status: 'success' | 'failed' | 'building';
  name: string;
  brand?: string;
  category?: string;
  previewUrl?: string;
  sourceArtifact?: string;
  screenshots?: string[];
  pages: WebsitePage[];
  buildStatus: 'passed' | 'failed' | 'skipped';
  debugAttempts: number;
  summary: string;
  files?: WebsiteFile[];
  logs?: string[];
  requirements?: {
    brand?: string;
    category?: string;
    brandStory?: string;
    productCatalog?: {
      id?: string;
      name: string;
      price: number | string;
      description?: string;
      category?: string;
      rating?: number | string;
      image?: string;
    }[];
    [key: string]: unknown;
  };
  designSpec?: Record<string, unknown>;
}

export interface NormalizedArtifact {
  artifactId: string;
  type: ArtifactType;
  title: string;
  description?: string;
  mimeType: string;
  rawContent: string;
  data?: ChartSpec | TableSpec | CodeSpec | FactCheckSpec | WebsiteSpec | string | Record<string, unknown>;
  sourceAgent?: string;
  status: 'completed' | 'failed' | 'processing';
  error?: string;
}

export interface MultiArtifactComposite {
  narrative?: string;
  artifacts: NormalizedArtifact[];
}
