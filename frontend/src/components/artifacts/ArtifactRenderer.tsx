'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type {
  NormalizedArtifact,
  ChartSpec,
  TableSpec,
  CodeSpec,
  FactCheckSpec,
  WebsiteSpec,
} from '@/lib/artifacts/types';
import { extractMultiArtifacts, normalizeArtifact } from '@/lib/artifacts/normalizer';
import ChartRenderer from './ChartRenderer';
import TableRenderer from './TableRenderer';
import CodeRenderer from './CodeRenderer';
import HtmlRenderer from './HtmlRenderer';
import ImageRenderer from './ImageRenderer';
import JsonRenderer from './JsonRenderer';
import PdfRenderer from './PdfRenderer';
import FactCheckRenderer from './FactCheckRenderer';
import WebsiteArtifactRenderer from './WebsiteArtifactRenderer';

interface ArtifactRendererProps {
  artifact?: NormalizedArtifact;
  rawContent?: string | unknown;
  sourceAgent?: string;
  defaultTitle?: string;
}

export default function ArtifactRenderer({
  artifact,
  rawContent,
  sourceAgent,
  defaultTitle,
}: ArtifactRendererProps) {
  // If direct artifact provided
  if (artifact) {
    return <SingleArtifactRenderer artifact={artifact} />;
  }

  // If rawContent provided (string or object)
  if (rawContent !== null && rawContent !== undefined) {
    if (typeof rawContent === 'string') {
      const composite = extractMultiArtifacts(rawContent, sourceAgent);

      if (composite.artifacts.length > 0) {
        return (
          <div className="space-y-4">
            {composite.narrative && (
              <div className="prose prose-invert prose-sm max-w-none text-zinc-300 leading-relaxed">
                <ReactMarkdown>{composite.narrative}</ReactMarkdown>
              </div>
            )}
            {composite.artifacts.map((art, idx) => (
              <SingleArtifactRenderer key={art.artifactId || idx} artifact={art} />
            ))}
          </div>
        );
      }
    }

    const singleArt = normalizeArtifact(rawContent, sourceAgent, defaultTitle);
    return <SingleArtifactRenderer artifact={singleArt} />;
  }

  return null;
}

function SingleArtifactRenderer({ artifact }: { artifact: NormalizedArtifact }) {
  if (process.env.NODE_ENV !== 'production') {
    const rendererMap: Record<string, string> = {
      website: 'WebsiteArtifactRenderer',
      fact_check: 'FactCheckRenderer',
      chart: 'ChartRenderer',
      table: 'TableRenderer',
      code: 'CodeRenderer',
      html: 'HtmlRenderer',
      image: 'ImageRenderer',
      pdf: 'PdfRenderer',
      json: 'JsonRenderer',
      markdown: 'MarkdownRenderer',
      text: 'TextRenderer',
    };
    console.log(`[ArtifactRenderer] Using renderer: ${rendererMap[artifact.type] || 'TextRenderer'}`);
  }

  switch (artifact.type) {
    case 'website':
      return (
        <WebsiteArtifactRenderer
          spec={artifact.data as WebsiteSpec}
          rawJson={artifact.rawContent}
          title={artifact.title}
        />
      );

    case 'fact_check':
      return (
        <FactCheckRenderer
          spec={artifact.data as FactCheckSpec}
          rawJson={artifact.rawContent}
          title={artifact.title}
        />
      );

    case 'chart':
      return (
        <ChartRenderer
          spec={artifact.data as ChartSpec}
          rawJson={artifact.rawContent}
          title={artifact.title}
        />
      );

    case 'table':
      return <TableRenderer spec={artifact.data as TableSpec} title={artifact.title} />;

    case 'code':
      return <CodeRenderer spec={artifact.data as CodeSpec} title={artifact.title} />;

    case 'html':
      return <HtmlRenderer htmlContent={artifact.rawContent} title={artifact.title} />;

    case 'image':
      return <ImageRenderer url={artifact.rawContent} title={artifact.title} />;

    case 'pdf':
      return <PdfRenderer url={artifact.rawContent} title={artifact.title} />;

    case 'json':
      return (
        <JsonRenderer
          data={artifact.data}
          title={artifact.title}
          rawString={artifact.rawContent}
        />
      );

    case 'markdown':
      return (
        <div className="prose prose-invert prose-sm max-w-none text-zinc-300 leading-relaxed">
          <ReactMarkdown>{artifact.rawContent}</ReactMarkdown>
        </div>
      );

    case 'text':
    default:
      return (
        <div className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
          {artifact.rawContent}
        </div>
      );
  }
}
