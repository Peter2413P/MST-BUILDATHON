'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ChartSpec } from '@/lib/artifacts/types';

interface ChartRendererProps {
  spec: ChartSpec | unknown;
  rawJson?: string;
  title?: string;
}

const PALETTE = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#ef4444', // Red
];

export default function ChartRenderer({ spec, rawJson, title }: ChartRendererProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'json'>('chart');
  const [copied, setCopied] = useState(false);

  // Validate chart specification
  const chartSpec = spec as Partial<ChartSpec> | null;
  const labels = chartSpec?.data?.labels;
  const datasets = chartSpec?.data?.datasets;
  const chartType = String(chartSpec?.type || 'bar').toLowerCase();

  const isSpecValid =
    Array.isArray(labels) &&
    labels.length > 0 &&
    Array.isArray(datasets) &&
    datasets.length > 0 &&
    datasets.every(ds => Array.isArray(ds?.data) && ds.data.length > 0);

  if (!isSpecValid) {
    return (
      <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4 text-xs text-red-300 space-y-2">
        <div className="flex items-center gap-2 font-medium">
          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Chart could not be rendered because the chart specification is incomplete.</span>
        </div>
        {rawJson && (
          <details className="mt-2 text-[11px] text-zinc-400">
            <summary className="cursor-pointer hover:text-zinc-200">View raw output</summary>
            <pre className="mt-2 p-2 bg-black/60 rounded border border-zinc-800 overflow-x-auto text-[10px] font-mono text-zinc-300">
              {rawJson}
            </pre>
          </details>
        )}
      </div>
    );
  }

  // Transform Chart.js shape into recharts data array
  const transformedData = labels.map((label, idx) => {
    const row: Record<string, string | number> = { name: String(label) };
    datasets.forEach((ds, dsIdx) => {
      const key = ds.label || `Series ${dsIdx + 1}`;
      const rawVal = ds.data[idx] ?? ds.data[ds.data.length - 1] ?? 0;
      row[key] = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 0;
    });
    return row;
  });

  const chartTitle = chartSpec?.options?.title?.text || title || 'Visual Chart';

  function handleCopyJson() {
    const text = rawJson || JSON.stringify(spec, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadCsv() {
    if (!labels || !datasets) return;
    const headers = ['Label', ...datasets.map((d, i) => d.label || `Dataset ${i + 1}`)].join(',');
    const rows = labels.map((l, i) => [l, ...datasets.map(d => d.data[i] ?? '')].join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${chartTitle.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="bg-[#121216] border border-zinc-800 rounded-xl overflow-hidden shadow-lg my-2.5">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#17171d] border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">
            📊
          </div>
          <span className="font-medium text-xs text-zinc-100">{chartTitle}</span>
          <span className="text-[10px] text-zinc-500 font-mono uppercase px-1.5 py-0.5 bg-zinc-800/70 rounded">
            {chartType}
          </span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          <div className="flex bg-zinc-900 rounded-md p-0.5 border border-zinc-800">
            <button
              onClick={() => setViewMode('chart')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                viewMode === 'chart' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Chart
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

          <button
            onClick={handleDownloadCsv}
            title="Download CSV"
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4">
        {viewMode === 'json' ? (
          <div className="relative">
            <button
              onClick={handleCopyJson}
              className="absolute top-2 right-2 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] rounded border border-zinc-700 transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy JSON'}
            </button>
            <pre className="p-3 bg-black/80 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[300px]">
              {rawJson || JSON.stringify(spec, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={transformedData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  {datasets.map((ds, idx) => (
                    <Line
                      key={idx}
                      type="monotone"
                      dataKey={ds.label || `Series ${idx + 1}`}
                      stroke={PALETTE[idx % PALETTE.length]}
                      strokeWidth={2.5}
                      dot={{ fill: PALETTE[idx % PALETTE.length], r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              ) : chartType === 'pie' || chartType === 'doughnut' ? (
                <PieChart>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Pie
                    data={transformedData}
                    dataKey={datasets[0]?.label || `Series 1`}
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={chartType === 'doughnut' ? 55 : 0}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {transformedData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Pie>
                </PieChart>
              ) : chartType === 'area' ? (
                <AreaChart data={transformedData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  {datasets.map((ds, idx) => (
                    <Area
                      key={idx}
                      type="monotone"
                      dataKey={ds.label || `Series ${idx + 1}`}
                      stroke={PALETTE[idx % PALETTE.length]}
                      fill={PALETTE[idx % PALETTE.length]}
                      fillOpacity={0.25}
                    />
                  ))}
                </AreaChart>
              ) : (
                /* Default Bar Chart */
                <BarChart data={transformedData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  {datasets.map((ds, idx) => (
                    <Bar
                      key={idx}
                      dataKey={ds.label || `Series ${idx + 1}`}
                      fill={PALETTE[idx % PALETTE.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
