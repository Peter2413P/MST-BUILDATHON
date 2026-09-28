'use client';

import React, { useState } from 'react';

interface HtmlRendererProps {
  htmlContent: string;
  title?: string;
}

export default function HtmlRenderer({ htmlContent, title }: HtmlRendererProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenNewTab() {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  return (
    <div
      className={`bg-[#121216] border border-zinc-800 rounded-xl overflow-hidden shadow-lg my-2.5 ${
        fullscreen ? 'fixed inset-4 z-50 flex flex-col bg-[#121216]' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#17171d] border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 font-mono text-xs">🌐</span>
          <span className="font-medium text-xs text-zinc-200">{title || 'HTML Component Preview'}</span>
          <span className="text-[10px] bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 font-mono px-1.5 py-0.5 rounded">
            Sandboxed
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] rounded border border-zinc-700 transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy HTML'}
          </button>
          <button
            onClick={handleOpenNewTab}
            title="Open in new tab"
            className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          <button
            onClick={() => setFullscreen(prev => !prev)}
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sandboxed iframe */}
      <div className={`w-full bg-white ${fullscreen ? 'flex-1 h-full' : 'h-[360px]'}`}>
        <iframe
          srcDoc={htmlContent}
          sandbox="allow-scripts allow-same-origin"
          title={title || 'HTML Artifact Sandbox'}
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
