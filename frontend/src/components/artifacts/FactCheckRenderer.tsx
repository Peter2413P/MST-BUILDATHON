'use client';

import React, { useState } from 'react';
import type { FactCheckSpec, FactCheckItem } from '@/lib/artifacts/types';

interface FactCheckRendererProps {
  spec?: FactCheckSpec | unknown;
  items?: FactCheckItem[];
  rawJson?: string;
  title?: string;
}

export default function FactCheckRenderer({
  spec,
  items: directItems,
  rawJson,
  title,
}: FactCheckRendererProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'json'>('cards');
  const [copied, setCopied] = useState(false);

  // Extract items
  let items: FactCheckItem[] = [];
  if (Array.isArray(directItems)) {
    items = directItems;
  } else if (spec && typeof spec === 'object') {
    const s = spec as Partial<FactCheckSpec>;
    if (Array.isArray(s.items)) {
      items = s.items;
    } else if (Array.isArray(spec)) {
      items = spec as FactCheckItem[];
    }
  }

  const factCheckTitle = title || (spec as FactCheckSpec)?.title || 'Fact Check Results';

  function handleCopyJson() {
    const text = rawJson || JSON.stringify(spec || items, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const trueCount = items.filter(i => String(i.verdict).toLowerCase() === 'true').length;
  const falseCount = items.filter(i => String(i.verdict).toLowerCase() === 'false').length;
  const uncertainCount = items.length - trueCount - falseCount;

  return (
    <div className="bg-[#121216] border border-zinc-800 rounded-xl overflow-hidden shadow-lg my-2.5">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#17171d] border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-xs font-bold shadow-sm">
            ✓
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-zinc-100 uppercase tracking-wide">
                {factCheckTitle}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-800/90 text-zinc-400 rounded-full border border-zinc-700/50">
                {items.length} {items.length === 1 ? 'Claim' : 'Claims'} Checked
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Summary Counts */}
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono">
            {trueCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                ✓ {trueCount} True
              </span>
            )}
            {falseCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/60 text-rose-400">
                ✕ {falseCount} False
              </span>
            )}
            {uncertainCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-400">
                ? {uncertainCount} Uncertain
              </span>
            )}
          </div>

          <div className="flex bg-zinc-900 rounded-md p-0.5 border border-zinc-800">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                viewMode === 'cards' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                viewMode === 'json' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Raw Spec
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4">
        {viewMode === 'json' ? (
          <div className="relative">
            <button
              onClick={handleCopyJson}
              className="absolute top-2 right-2 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] rounded border border-zinc-700 transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy JSON'}
            </button>
            <pre className="p-3.5 bg-black/80 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[350px]">
              {rawJson || JSON.stringify(spec || items, null, 2)}
            </pre>
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-zinc-500 text-xs">
            No fact check claims available.
          </div>
        ) : (
          <div className="space-y-3.5">
            {items.map((item, idx) => (
              <FactCheckItemCard key={idx} item={item} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FactCheckItemCard({ item, index }: { item: FactCheckItem; index: number }) {
  const verdictLower = String(item.verdict || 'uncertain').toLowerCase().trim();

  const isTrue = verdictLower === 'true' || verdictLower === 'mostly-true' || verdictLower === 'verified';
  const isFalse = verdictLower === 'false' || verdictLower === 'mostly-false' || verdictLower === 'debunked';

  // Badge configuration
  const config = isTrue
    ? {
        border: 'border-emerald-800/40 hover:border-emerald-700/60',
        bg: 'bg-emerald-950/10',
        badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        icon: '✓',
        label: 'TRUE',
        textColor: 'text-emerald-400',
      }
    : isFalse
    ? {
        border: 'border-rose-800/40 hover:border-rose-700/60',
        bg: 'bg-rose-950/10',
        badgeBg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        icon: '✕',
        label: 'FALSE',
        textColor: 'text-rose-400',
      }
    : {
        border: 'border-amber-800/40 hover:border-amber-700/60',
        bg: 'bg-amber-950/10',
        badgeBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        icon: '?',
        label: item.verdict ? String(item.verdict).toUpperCase() : 'UNCERTAIN',
        textColor: 'text-amber-400',
      };

  // Format confidence
  let confidenceDisplay: string | null = null;
  if (typeof item.confidence === 'number') {
    const pct = item.confidence <= 1 ? Math.round(item.confidence * 100) : Math.round(item.confidence);
    confidenceDisplay = `${pct}%`;
  } else if (item.confidence) {
    confidenceDisplay = String(item.confidence);
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-200 ${config.bg} ${config.border} space-y-3 shadow-sm`}
    >
      {/* Top Bar: Claim + Verdict Badge + Confidence */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div
            className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${config.badgeBg}`}
          >
            {config.icon}
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              Claim {index + 1}
            </span>
            <h4 className="text-[13px] font-medium text-zinc-100 leading-snug">
              {item.claim}
            </h4>
          </div>
        </div>

        {/* Verdict & Confidence Pill */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide border flex items-center gap-1 ${config.badgeBg}`}
          >
            <span>{config.icon}</span>
            <span>{config.label}</span>
          </span>
          {confidenceDisplay && (
            <span className="px-2 py-1 rounded-md text-[11px] font-mono text-zinc-300 bg-zinc-800/80 border border-zinc-700/60">
              {confidenceDisplay}
            </span>
          )}
        </div>
      </div>

      {/* Explanation Section */}
      {item.explanation && (
        <div className="text-xs text-zinc-300 leading-relaxed bg-black/30 p-3 rounded-lg border border-zinc-800/70 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
            Explanation
          </span>
          <p className="text-zinc-300">{item.explanation}</p>
        </div>
      )}

      {/* Caveats Section (if available) */}
      {item.caveats && (
        <div className="text-[11px] text-zinc-400 bg-amber-950/10 border border-amber-900/30 p-2.5 rounded-lg flex items-start gap-2">
          <span className="text-amber-400 text-xs shrink-0 mt-0.5">⚠️</span>
          <div>
            <span className="font-medium text-amber-300/90 text-[10px] uppercase font-mono block">
              Caveats & Assumptions
            </span>
            <p className="text-zinc-400 mt-0.5">{item.caveats}</p>
          </div>
        </div>
      )}
    </div>
  );
}
