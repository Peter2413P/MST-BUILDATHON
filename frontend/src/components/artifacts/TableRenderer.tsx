'use client';

import React, { useState } from 'react';
import type { TableSpec } from '@/lib/artifacts/types';

interface TableRendererProps {
  spec: TableSpec;
  title?: string;
}

export default function TableRenderer({ spec, title }: TableRendererProps) {
  const [filter, setFilter] = useState('');
  const [copied, setCopied] = useState(false);

  const columns = spec?.columns || [];
  const rawRows = spec?.rows || [];

  const filteredRows = rawRows.filter(row =>
    row.some(cell => String(cell).toLowerCase().includes(filter.toLowerCase()))
  );

  function handleCopyCsv() {
    const header = columns.join(',');
    const body = rawRows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    navigator.clipboard.writeText(`${header}\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-[#121216] border border-zinc-800 rounded-xl overflow-hidden shadow-lg my-2.5">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#17171d] border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
            📋
          </div>
          <span className="font-medium text-xs text-zinc-100">{title || spec.title || 'Structured Table'}</span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {rawRows.length} rows · {columns.length} columns
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search rows..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-2 py-0.5 bg-zinc-900 border border-zinc-700/80 rounded text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleCopyCsv}
            title="Copy as CSV"
            className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] rounded border border-zinc-700 transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy CSV'}
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto max-h-[340px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#18181f] border-b border-zinc-800 text-zinc-400 sticky top-0 z-10">
              {columns.map((col, idx) => (
                <th key={idx} className="px-4 py-2 font-medium font-mono text-[11px]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-zinc-500 text-xs font-mono">
                  No matching records found
                </td>
              </tr>
            ) : (
              filteredRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-zinc-800/30 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5 text-zinc-300 font-sans">
                      {cell !== null && cell !== undefined ? String(cell) : '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
