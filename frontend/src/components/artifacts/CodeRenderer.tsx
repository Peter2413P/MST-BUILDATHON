'use client';

import React, { useState } from 'react';
import type { CodeSpec } from '@/lib/artifacts/types';

interface CodeRendererProps {
  spec: CodeSpec;
  title?: string;
}

export default function CodeRenderer({ spec, title }: CodeRendererProps) {
  const [copied, setCopied] = useState(false);

  const language = spec.language || 'typescript';
  const code = spec.code || '';
  const filename = spec.filename || title || `${language}-artifact`;

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const ext = language === 'python' ? '.py' : language === 'javascript' ? '.js' : language === 'sql' ? '.sql' : language === 'html' ? '.html' : '.ts';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.includes('.') ? filename : `${filename}${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="bg-[#121216] border border-zinc-800 rounded-xl overflow-hidden shadow-lg my-2.5">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#17171d] border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 font-mono text-xs">📄</span>
          <span className="font-medium text-xs text-zinc-200 font-mono">{filename}</span>
          <span className="text-[10px] bg-zinc-800 text-zinc-400 font-mono px-1.5 py-0.5 rounded uppercase">
            {language}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] rounded border border-zinc-700 transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy Code'}
          </button>
          <button
            onClick={handleDownload}
            title="Download file"
            className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Code Block */}
      <pre className="p-4 bg-[#0a0a0d] text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed max-h-[380px]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
