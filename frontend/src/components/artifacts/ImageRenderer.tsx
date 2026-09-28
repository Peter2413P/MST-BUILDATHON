'use client';

import React, { useState } from 'react';

interface ImageRendererProps {
  url: string;
  title?: string;
}

export default function ImageRenderer({ url, title }: ImageRendererProps) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="bg-[#121216] border border-zinc-800 rounded-xl overflow-hidden shadow-lg my-2.5">
      <div className="flex items-center justify-between px-4 py-2 bg-[#17171d] border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 font-mono text-xs">🖼️</span>
          <span className="font-medium text-xs text-zinc-200">{title || 'Image Artifact'}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => window.open(url, '_blank')}
            title="Open full image"
            className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors text-[11px] px-2"
          >
            Open Original ↗
          </button>
        </div>
      </div>

      <div className="p-4 flex items-center justify-center bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={title || 'Artifact Deliverable'}
          className="max-h-[400px] w-auto object-contain rounded-lg border border-zinc-800/80 shadow-md"
        />
      </div>
    </div>
  );
}
