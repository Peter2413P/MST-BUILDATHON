'use client';

import React, { useState } from 'react';

interface JsonRendererProps {
  data: unknown;
  title?: string;
  rawString?: string;
}

export default function JsonRenderer({ data, title, rawString }: JsonRendererProps) {
  const [copied, setCopied] = useState(false);
  const formatted = rawString || JSON.stringify(data, null, 2);

  function handleCopy() {
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-[#121216] border border-zinc-800 rounded-xl overflow-hidden shadow-lg my-2.5">
      <div className="flex items-center justify-between px-4 py-2 bg-[#17171d] border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-mono text-xs">{'{ }'}</span>
          <span className="font-medium text-xs text-zinc-200">{title || 'Structured JSON'}</span>
        </div>

        <button
          onClick={handleCopy}
          className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] rounded border border-zinc-700 transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy JSON'}
        </button>
      </div>

      <pre className="p-4 bg-[#0a0a0d] text-cyan-400 font-mono text-xs overflow-x-auto leading-relaxed max-h-[320px]">
        <code>{formatted}</code>
      </pre>
    </div>
  );
}
