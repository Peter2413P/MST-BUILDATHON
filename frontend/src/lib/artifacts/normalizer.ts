import { v4 as uuidv4 } from 'uuid';
import type {
  ArtifactType,
  ChartSpec,
  TableSpec,
  CodeSpec,
  FactCheckSpec,
  FactCheckItem,
  NormalizedArtifact,
  MultiArtifactComposite,
} from './types';

/**
 * Validates whether an object is a well-formed ChartSpec.
 * Supports Chart.js structure with case-insensitivity.
 */
export function isValidChartSpec(obj: unknown): obj is ChartSpec {
  if (!obj || typeof obj !== 'object') return false;
  const cand = obj as Partial<ChartSpec>;

  const validTypes = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polararea', 'area'];
  if (!cand.type || !validTypes.includes(String(cand.type).toLowerCase())) {
    return false;
  }

  if (!cand.data || typeof cand.data !== 'object') return false;
  const data = cand.data as { labels?: unknown; datasets?: unknown };

  if (!Array.isArray(data.labels) || data.labels.length === 0) return false;
  if (!Array.isArray(data.datasets) || data.datasets.length === 0) return false;

  for (const ds of data.datasets) {
    if (!ds || typeof ds !== 'object') return false;
    const dataset = ds as { data?: unknown };
    if (!Array.isArray(dataset.data) || dataset.data.length === 0) return false;
    // Ensure dataset values have numbers or parseable numeric values
    const hasNumbers = dataset.data.some(d => typeof d === 'number' || (!isNaN(Number(d)) && d !== null && d !== ''));
    if (!hasNumbers) return false;
  }

  return true;
}

/**
 * Validates whether an object is a well-formed TableSpec.
 */
export function isValidTableSpec(obj: unknown): obj is TableSpec {
  if (!obj || typeof obj !== 'object') return false;
  const cand = obj as Partial<TableSpec>;
  if (!Array.isArray(cand.columns) || cand.columns.length === 0) return false;
  if (!Array.isArray(cand.rows) || cand.rows.length === 0) return false;
  return true;
}

/**
 * Validates whether an array consists of FactCheckItem objects.
 */
export function isFactCheckArray(arr: unknown): arr is FactCheckItem[] {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.every(
    item =>
      item &&
      typeof item === 'object' &&
      'claim' in item &&
      typeof (item as Record<string, unknown>).claim === 'string' &&
      ('verdict' in item || 'confidence' in item || 'explanation' in item)
  );
}

/**
 * Validates whether an object is a well-formed FactCheckSpec.
 */
export function isValidFactCheckSpec(obj: unknown): obj is FactCheckSpec {
  if (!obj || typeof obj !== 'object') return false;
  const cand = obj as Partial<FactCheckSpec>;
  if (cand.type === 'fact_check' && Array.isArray(cand.items)) {
    return isFactCheckArray(cand.items);
  }
  return false;
}

/**
 * Attempts to repair and salvage truncated Chart.js JSON string if possible.
 */
function trySalvageChartJson(raw: string): ChartSpec | null {
  try {
    const typeMatch = raw.match(/"type"\s*:\s*"(\w+)"/i);
    const labelsMatch = raw.match(/"labels"\s*:\s*(\[[^\]]*\])/);
    const datasetsMatch = raw.match(/"datasets"\s*:\s*(\[\s*\{[\s\S]*?\}\s*\])/);

    if (typeMatch && labelsMatch && datasetsMatch) {
      const type = typeMatch[1].toLowerCase() as ChartSpec['type'];
      const labels = JSON.parse(labelsMatch[1]);
      const datasets = JSON.parse(datasetsMatch[1]);

      const titleMatch = raw.match(/"text"\s*:\s*"([^"]+)"/);
      const title = titleMatch ? titleMatch[1] : undefined;

      const salvaged: ChartSpec = {
        type,
        data: { labels, datasets },
        options: title ? { title: { display: true, text: title } } : undefined,
      };

      if (isValidChartSpec(salvaged)) {
        return salvaged;
      }
    }
  } catch {
    /* fallback fails silently */
  }
  return null;
}

/**
 * Scans text to find candidate JSON objects by tracking balanced braces.
 */
function extractJsonCandidates(text: string): { parsed: unknown; raw: string; start: number; end: number }[] {
  const results: { parsed: unknown; raw: string; start: number; end: number }[] = [];
  let depth = 0;
  let inString = false;
  let isEscaped = false;
  let startIdx = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (char === '\\' && !isEscaped) {
        isEscaped = true;
      } else {
        if (char === '"' && !isEscaped) {
          inString = false;
        }
        isEscaped = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{' || char === '[') {
      if (depth === 0) {
        startIdx = i;
      }
      depth++;
    } else if (char === '}' || char === ']') {
      if (depth > 0) {
        depth--;
        if (depth === 0 && startIdx !== -1) {
          const rawCandidate = text.slice(startIdx, i + 1);
          try {
            const parsed = JSON.parse(rawCandidate);
            results.push({ parsed, raw: rawCandidate, start: startIdx, end: i + 1 });
          } catch {
            // Ignored
          }
          startIdx = -1;
        }
      }
    }
  }

  return results;
}

/**
 * Parses markdown table into TableSpec if possible.
 */
function parseMarkdownTable(markdown: string): TableSpec | null {
  const lines = markdown.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  if (!lines[0].includes('|') || !lines[1].includes('|') || !lines[1].includes('-')) return null;

  const splitRow = (line: string) =>
    line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(c => c.trim());

  const columns = splitRow(lines[0]);
  const rows: (string | number)[][] = [];

  for (let i = 2; i < lines.length; i++) {
    if (lines[i].includes('|')) {
      const cells = splitRow(lines[i]).map(val => {
        const num = Number(val.replace(/,/g, ''));
        return !isNaN(num) && val !== '' ? num : val;
      });
      rows.push(cells);
    }
  }

  if (columns.length > 0 && rows.length > 0) {
    return { columns, rows };
  }
  return null;
}

/**
 * Normalizes raw output into a typed, validated NormalizedArtifact.
 */
export function normalizeArtifact(
  rawInput: unknown,
  sourceAgent?: string,
  defaultTitle?: string
): NormalizedArtifact {
  const id = uuidv4();

  if (process.env.NODE_ENV !== 'production') {
    console.log('[ArtifactNormalizer] Raw output received');
    console.log('[ArtifactNormalizer] Attempting structured artifact detection');
  }

  // 1. Direct Object / Array input checks
  if (rawInput && typeof rawInput === 'object') {
    // A. Fact Check Array Check
    if (isFactCheckArray(rawInput)) {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: fact_check');
      return {
        artifactId: id,
        type: 'fact_check',
        title: defaultTitle || 'Fact Check Results',
        mimeType: 'application/vnd.agentmesh.factcheck+json',
        rawContent: JSON.stringify(rawInput, null, 2),
        data: {
          type: 'fact_check',
          title: defaultTitle || 'Fact Check Results',
          items: rawInput,
        },
        sourceAgent,
        status: 'completed',
      };
    }

    if (isValidFactCheckSpec(rawInput)) {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: fact_check');
      return {
        artifactId: id,
        type: 'fact_check',
        title: rawInput.title || defaultTitle || 'Fact Check Results',
        mimeType: 'application/vnd.agentmesh.factcheck+json',
        rawContent: JSON.stringify(rawInput, null, 2),
        data: rawInput,
        sourceAgent,
        status: 'completed',
      };
    }

    // B. Chart Check
    if (isValidChartSpec(rawInput)) {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: chart');
      return {
        artifactId: id,
        type: 'chart',
        title: rawInput.options?.title?.text || defaultTitle || 'Visual Chart',
        mimeType: 'application/vnd.agentmesh.chart+json',
        rawContent: JSON.stringify(rawInput, null, 2),
        data: rawInput,
        sourceAgent,
        status: 'completed',
      };
    }

    // C. Table Check
    if (isValidTableSpec(rawInput)) {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: table');
      return {
        artifactId: id,
        type: 'table',
        title: rawInput.title || defaultTitle || 'Data Table',
        mimeType: 'application/vnd.agentmesh.table+json',
        rawContent: JSON.stringify(rawInput, null, 2),
        data: rawInput,
        sourceAgent,
        status: 'completed',
      };
    }

    // D. Explicit artifact objects
    const candObj = rawInput as Record<string, unknown>;
    if (candObj.type === 'fact_check' && Array.isArray(candObj.items)) {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: fact_check');
      return {
        artifactId: id,
        type: 'fact_check',
        title: (candObj.title as string) || defaultTitle || 'Fact Check Results',
        mimeType: 'application/vnd.agentmesh.factcheck+json',
        rawContent: JSON.stringify(rawInput, null, 2),
        data: candObj as unknown as FactCheckSpec,
        sourceAgent,
        status: 'completed',
      };
    }

    if (candObj.type === 'html' && typeof candObj.content === 'string') {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: html');
      return {
        artifactId: id,
        type: 'html',
        title: defaultTitle || 'HTML Deliverable',
        mimeType: 'text/html',
        rawContent: candObj.content,
        data: candObj.content,
        sourceAgent,
        status: 'completed',
      };
    }

    if (candObj.type === 'pdf' && (typeof candObj.url === 'string' || typeof candObj.content === 'string')) {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: pdf');
      return {
        artifactId: id,
        type: 'pdf',
        title: defaultTitle || 'PDF Report',
        mimeType: 'application/pdf',
        rawContent: String(candObj.url || candObj.content),
        data: String(candObj.url || candObj.content),
        sourceAgent,
        status: 'completed',
      };
    }

    if (candObj.type === 'image' && typeof candObj.url === 'string') {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: image');
      return {
        artifactId: id,
        type: 'image',
        title: defaultTitle || 'Image Artifact',
        mimeType: 'image/png',
        rawContent: candObj.url,
        data: candObj.url,
        sourceAgent,
        status: 'completed',
      };
    }

    if (candObj.type === 'code' && typeof candObj.code === 'string') {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: code');
      return {
        artifactId: id,
        type: 'code',
        title: (candObj.filename as string) || defaultTitle || 'Code Snippet',
        mimeType: 'text/plain',
        rawContent: candObj.code,
        data: {
          language: (candObj.language as string) || 'typescript',
          code: candObj.code,
          filename: candObj.filename as string,
        },
        sourceAgent,
        status: 'completed',
      };
    }

    if (candObj.type === 'json' || candObj.type === 'data') {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: json');
      return {
        artifactId: id,
        type: 'json',
        title: defaultTitle || 'JSON Data Deliverable',
        mimeType: 'application/json',
        rawContent: JSON.stringify(rawInput, null, 2),
        data: rawInput as Record<string, unknown>,
        sourceAgent,
        status: 'completed',
      };
    }
  }

  // 2. String input parsing
  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();

    // A. Check for JSON structure via balanced brace scanner or markdown code blocks
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let parsedJson: unknown = null;
    let jsonString = '';

    if (codeBlockMatch) {
      try {
        parsedJson = JSON.parse(codeBlockMatch[1].trim());
        jsonString = codeBlockMatch[1].trim();
      } catch {
        /* not JSON inside code block */
      }
    }

    if (!parsedJson) {
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          parsedJson = JSON.parse(trimmed);
          jsonString = trimmed;
        } catch {
          // Attempt salvage for cut-off Chart.js JSON
          parsedJson = trySalvageChartJson(trimmed);
          if (parsedJson) jsonString = JSON.stringify(parsedJson, null, 2);
        }
      }
    }

    if (!parsedJson) {
      const candidates = extractJsonCandidates(trimmed);
      for (const cand of candidates) {
        if (
          isFactCheckArray(cand.parsed) ||
          isValidFactCheckSpec(cand.parsed) ||
          isValidChartSpec(cand.parsed) ||
          isValidTableSpec(cand.parsed) ||
          (typeof cand.parsed === 'object' && cand.parsed !== null && 'type' in cand.parsed)
        ) {
          parsedJson = cand.parsed;
          jsonString = cand.raw;
          break;
        }
      }
    }

    if (!parsedJson) {
      parsedJson = trySalvageChartJson(trimmed);
      if (parsedJson) jsonString = JSON.stringify(parsedJson, null, 2);
    }

    if (parsedJson) {
      // 1. Fact Check Array / Spec
      if (isFactCheckArray(parsedJson)) {
        if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: fact_check');
        return {
          artifactId: id,
          type: 'fact_check',
          title: defaultTitle || 'Fact Check Results',
          mimeType: 'application/vnd.agentmesh.factcheck+json',
          rawContent: jsonString || trimmed,
          data: {
            type: 'fact_check',
            title: defaultTitle || 'Fact Check Results',
            items: parsedJson,
          },
          sourceAgent,
          status: 'completed',
        };
      }

      if (isValidFactCheckSpec(parsedJson)) {
        if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: fact_check');
        return {
          artifactId: id,
          type: 'fact_check',
          title: parsedJson.title || defaultTitle || 'Fact Check Results',
          mimeType: 'application/vnd.agentmesh.factcheck+json',
          rawContent: jsonString || trimmed,
          data: parsedJson,
          sourceAgent,
          status: 'completed',
        };
      }

      // 2. Chart Spec
      if (isValidChartSpec(parsedJson)) {
        if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: chart');
        return {
          artifactId: id,
          type: 'chart',
          title: parsedJson.options?.title?.text || defaultTitle || 'Quarterly Revenue Comparison',
          mimeType: 'application/vnd.agentmesh.chart+json',
          rawContent: jsonString || trimmed,
          data: parsedJson,
          sourceAgent,
          status: 'completed',
        };
      }

      // 3. Table Spec
      if (isValidTableSpec(parsedJson)) {
        if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: table');
        return {
          artifactId: id,
          type: 'table',
          title: parsedJson.title || defaultTitle || 'Structured Table',
          mimeType: 'application/vnd.agentmesh.table+json',
          rawContent: jsonString || trimmed,
          data: parsedJson,
          sourceAgent,
          status: 'completed',
        };
      }

      const candObj = parsedJson as Record<string, unknown>;
      if (candObj.type === 'fact_check' && Array.isArray(candObj.items)) {
        if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: fact_check');
        return {
          artifactId: id,
          type: 'fact_check',
          title: (candObj.title as string) || defaultTitle || 'Fact Check Results',
          mimeType: 'application/vnd.agentmesh.factcheck+json',
          rawContent: jsonString || trimmed,
          data: candObj as unknown as FactCheckSpec,
          sourceAgent,
          status: 'completed',
        };
      }

      if (candObj.type === 'html' && typeof candObj.content === 'string') {
        if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: html');
        return {
          artifactId: id,
          type: 'html',
          title: defaultTitle || 'HTML Deliverable',
          mimeType: 'text/html',
          rawContent: candObj.content,
          data: candObj.content,
          sourceAgent,
          status: 'completed',
        };
      }

      if (candObj.type === 'pdf' && (typeof candObj.url === 'string' || typeof candObj.content === 'string')) {
        if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: pdf');
        return {
          artifactId: id,
          type: 'pdf',
          title: defaultTitle || 'PDF Document',
          mimeType: 'application/pdf',
          rawContent: String(candObj.url || candObj.content),
          data: String(candObj.url || candObj.content),
          sourceAgent,
          status: 'completed',
        };
      }

      if (candObj.type === 'image' && typeof candObj.url === 'string') {
        if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: image');
        return {
          artifactId: id,
          type: 'image',
          title: defaultTitle || 'Image Deliverable',
          mimeType: 'image/png',
          rawContent: candObj.url,
          data: candObj.url,
          sourceAgent,
          status: 'completed',
        };
      }

      if (candObj.type === 'code' && typeof candObj.code === 'string') {
        if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: code');
        return {
          artifactId: id,
          type: 'code',
          title: (candObj.filename as string) || defaultTitle || 'Code Snippet',
          mimeType: 'text/plain',
          rawContent: candObj.code,
          data: {
            language: (candObj.language as string) || 'typescript',
            code: candObj.code,
            filename: candObj.filename as string,
          },
          sourceAgent,
          status: 'completed',
        };
      }

      // Explicit JSON type
      if (candObj.type === 'json' || candObj.type === 'data') {
        if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: json');
        return {
          artifactId: id,
          type: 'json',
          title: defaultTitle || 'Structured JSON Data',
          mimeType: 'application/json',
          rawContent: jsonString || trimmed,
          data: parsedJson as Record<string, unknown>,
          sourceAgent,
          status: 'completed',
        };
      }
    }

    // B. Check for HTML document / rich component
    if (/^<!DOCTYPE html>|<html[\s>]|<div[\s\S]*<\/div>|<svg[\s\S]*<\/svg>/i.test(trimmed)) {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: html');
      return {
        artifactId: id,
        type: 'html',
        title: defaultTitle || 'Interactive HTML Preview',
        mimeType: 'text/html',
        rawContent: trimmed,
        data: trimmed,
        sourceAgent,
        status: 'completed',
      };
    }

    // C. Check for Image URLs / base64
    if (/^data:image\/(png|jpeg|webp|svg\+xml|gif);base64,/i.test(trimmed) || /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(trimmed)) {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: image');
      return {
        artifactId: id,
        type: 'image',
        title: defaultTitle || 'Visual Image',
        mimeType: 'image/png',
        rawContent: trimmed,
        data: trimmed,
        sourceAgent,
        status: 'completed',
      };
    }

    // D. Check for Markdown Code Block
    const codeMatch = trimmed.match(/^```(\w+)?\n([\s\S]*?)\n```$/);
    if (codeMatch) {
      const lang = codeMatch[1] || 'text';
      const code = codeMatch[2];
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: code');
      return {
        artifactId: id,
        type: 'code',
        title: defaultTitle || `${lang.toUpperCase()} Code`,
        mimeType: 'text/plain',
        rawContent: trimmed,
        data: { language: lang, code },
        sourceAgent,
        status: 'completed',
      };
    }

    // E. Check for Markdown Table
    const mdTable = parseMarkdownTable(trimmed);
    if (mdTable) {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: table');
      return {
        artifactId: id,
        type: 'table',
        title: defaultTitle || 'Structured Table',
        mimeType: 'application/vnd.agentmesh.table+json',
        rawContent: trimmed,
        data: mdTable,
        sourceAgent,
        status: 'completed',
      };
    }

    // F. Markdown formatted content
    if (/^#{1,6}\s|\*\*|\*|_|\[.+\]\(.+\)|`[^`]+`|^-\s|^\d+\.\s/m.test(trimmed)) {
      if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: markdown');
      return {
        artifactId: id,
        type: 'markdown',
        title: defaultTitle || 'Report',
        mimeType: 'text/markdown',
        rawContent: trimmed,
        data: trimmed,
        sourceAgent,
        status: 'completed',
      };
    }

    // G. Plain text fallback
    if (process.env.NODE_ENV !== 'production') console.log('[ArtifactNormalizer] Detected output type: text');
    return {
      artifactId: id,
      type: 'text',
      title: defaultTitle || 'Text Deliverable',
      mimeType: 'text/plain',
      rawContent: trimmed,
      data: trimmed,
      sourceAgent,
      status: 'completed',
    };
  }

  // Fallback
  return {
    artifactId: id,
    type: 'text',
    title: defaultTitle || 'Deliverable',
    mimeType: 'text/plain',
    rawContent: String(rawInput),
    data: String(rawInput),
    sourceAgent,
    status: 'completed',
  };
}

/**
 * Extracts multiple artifacts if a narrative response contains embedded fact check, chart, table, code, or HTML blocks.
 */
export function extractMultiArtifacts(
  rawContent: string | null | undefined,
  sourceAgent?: string
): MultiArtifactComposite {
  if (!rawContent) return { artifacts: [] };
  const trimmed = rawContent.trim();

  const artifacts: NormalizedArtifact[] = [];
  let narrative = trimmed;

  // 1. Search for JSON specs inside markdown code blocks
  const codeBlockRegex = /```(?:json)?\s*([\[\{][\s\S]*?[\]\}])\s*```/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(trimmed)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (isFactCheckArray(parsed) || isValidFactCheckSpec(parsed)) {
        artifacts.push(normalizeArtifact(parsed, sourceAgent, 'Fact Check Results'));
        narrative = narrative.replace(match[0], '').trim();
      } else if (isValidChartSpec(parsed)) {
        artifacts.push(normalizeArtifact(parsed, sourceAgent, parsed.options?.title?.text || 'Quarterly Revenue Comparison'));
        narrative = narrative.replace(match[0], '').trim();
      } else if (isValidTableSpec(parsed)) {
        artifacts.push(normalizeArtifact(parsed, sourceAgent, parsed.title || 'Data Table'));
        narrative = narrative.replace(match[0], '').trim();
      } else if (typeof parsed === 'object' && parsed !== null && ('type' in parsed) && (parsed.type === 'html' || parsed.type === 'code' || parsed.type === 'image' || parsed.type === 'pdf')) {
        artifacts.push(normalizeArtifact(parsed, sourceAgent));
        narrative = narrative.replace(match[0], '').trim();
      }
    } catch {
      /* not valid JSON */
    }
  }

  // 2. Search for embedded JSON candidates (without code fences)
  const jsonCandidates = extractJsonCandidates(narrative);
  for (const cand of jsonCandidates) {
    if (isFactCheckArray(cand.parsed) || isValidFactCheckSpec(cand.parsed)) {
      artifacts.push(normalizeArtifact(cand.parsed, sourceAgent, 'Fact Check Results'));
      narrative = narrative.replace(cand.raw, '').trim();
    } else if (isValidChartSpec(cand.parsed)) {
      artifacts.push(normalizeArtifact(cand.parsed, sourceAgent, cand.parsed.options?.title?.text || 'Quarterly Revenue Comparison'));
      narrative = narrative.replace(cand.raw, '').trim();
    } else if (isValidTableSpec(cand.parsed)) {
      artifacts.push(normalizeArtifact(cand.parsed, sourceAgent, cand.parsed.title || 'Data Table'));
      narrative = narrative.replace(cand.raw, '').trim();
    } else if (typeof cand.parsed === 'object' && cand.parsed !== null && ('type' in cand.parsed)) {
      const p = cand.parsed as Record<string, unknown>;
      if (p.type === 'html' || p.type === 'code' || p.type === 'image' || p.type === 'pdf') {
        artifacts.push(normalizeArtifact(cand.parsed, sourceAgent));
        narrative = narrative.replace(cand.raw, '').trim();
      }
    }
  }

  // 3. If no structured artifact was extracted from text, evaluate full string
  if (artifacts.length === 0) {
    const mainArtifact = normalizeArtifact(trimmed, sourceAgent);
    if (
      mainArtifact.type === 'fact_check' ||
      mainArtifact.type === 'chart' ||
      mainArtifact.type === 'table' ||
      mainArtifact.type === 'html' ||
      mainArtifact.type === 'image' ||
      mainArtifact.type === 'pdf'
    ) {
      artifacts.push(mainArtifact);
      narrative = '';
    } else {
      artifacts.push(mainArtifact);
    }
  }

  return {
    narrative: narrative.length > 0 ? narrative : undefined,
    artifacts,
  };
}
