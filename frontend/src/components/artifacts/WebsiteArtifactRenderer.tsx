'use client';

import React, { useState } from 'react';
import type { WebsiteSpec, WebsiteFile } from '@/lib/artifacts/types';

interface WebsiteArtifactRendererProps {
  spec?: WebsiteSpec | unknown;
  rawJson?: string;
  title?: string;
}

export default function WebsiteArtifactRenderer({
  spec,
  rawJson,
  title,
}: WebsiteArtifactRendererProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'preview' | 'files' | 'json'>('overview');
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);
  const [copiedFile, setCopiedFile] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Parse specification
  const siteSpec = (spec as Partial<WebsiteSpec>) || {};
  const brand = siteSpec.brand || siteSpec.name || 'E-Commerce Store';
  const category = siteSpec.category || "Men's Fashion";
  const buildStatus = siteSpec.buildStatus || 'passed';
  const debugAttempts = siteSpec.debugAttempts ?? 0;
  const pages = siteSpec.pages || [
    { name: 'Home', path: '/', status: 'ready' as const },
    { name: 'Products', path: '/products', status: 'ready' as const },
    { name: 'Product Details', path: '/products/[id]', status: 'ready' as const },
    { name: 'Cart', path: '/cart', status: 'ready' as const },
    { name: 'Checkout', path: '/checkout', status: 'ready' as const },
  ];
  const files: WebsiteFile[] = siteSpec.files || [];
  const selectedFile = files[selectedFileIdx] || files[0];

  const [cartCount, setCartCount] = useState(0);
  const [sandboxPage, setSandboxPage] = useState<string>('home');
  const [lastAddedItem, setLastAddedItem] = useState<string | null>(null);

  // Dynamic catalog from requirements if available
  const catalogProducts = siteSpec.requirements?.productCatalog && siteSpec.requirements.productCatalog.length > 0
    ? siteSpec.requirements.productCatalog.map((p, i) => ({
        id: p.id || `prod-${i}`,
        name: p.name,
        price: typeof p.price === 'number' ? `$${p.price.toFixed(2)}` : String(p.price || '$99.00'),
        tag: p.category || siteSpec.category || 'Featured',
        rating: `★ ${p.rating || '4.9'}`,
        description: p.description || '',
        img: p.image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=80',
      }))
    : [
        {
          id: 'p-1',
          name: `${brand} Air Stealth Performance Sneaker`,
          price: '$189.99',
          tag: category || 'Footwear',
          rating: '★ 4.9',
          description: 'High-rebound cushioning with breathable engineered mesh.',
          img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=80',
        },
        {
          id: 'p-2',
          name: `${brand} Retro High Pro Edition`,
          price: '$149.00',
          tag: category || 'Footwear',
          rating: '★ 4.8',
          description: 'Iconic high-top profile with premium tumbled leather upper.',
          img: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=500&auto=format&fit=crop&q=80',
        },
        {
          id: 'p-3',
          name: `${brand} Carbon Aero Runner`,
          price: '$165.00',
          tag: category || 'Footwear',
          rating: '★ 4.9',
          description: 'Carbon-fiber propulsion plate for maximum energy return.',
          img: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&auto=format&fit=crop&q=80',
        },
        {
          id: 'p-4',
          name: `${brand} Obsidian Minimalist Trainer`,
          price: '$120.00',
          tag: category || 'Footwear',
          rating: '★ 4.7',
          description: 'Ultra-lightweight versatile training shoe for all-day comfort.',
          img: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&auto=format&fit=crop&q=80',
        },
      ];

  function handleAddToCart(name: string) {
    setCartCount(prev => prev + 1);
    setLastAddedItem(name);
    setTimeout(() => setLastAddedItem(null), 2000);
  }

  function handleCopyFile() {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  }

  function handleCopyJson() {
    const text = rawJson || JSON.stringify(spec, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  }

  function handleDownloadZip() {
    if (files.length === 0) return;
    const manifest = files.map(f => `--- FILE: ${f.path} ---\n${f.content}\n\n`).join('\n');
    const blob = new Blob([manifest], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${brand.toLowerCase().replace(/\s+/g, '_')}_storefront_bundle.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="bg-[#121216] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl my-3">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-[#17171d] border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold shadow-sm">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-zinc-100 uppercase tracking-wider">
                ✓ Website Built
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                {buildStatus === 'passed' ? 'Build Passed' : 'Build Status: ' + buildStatus}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
              {brand} · {category}
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5">
          <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 text-xs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                activeTab === 'overview' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                activeTab === 'preview' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Live Store Sandbox
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                activeTab === 'files' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Source Files ({files.length})
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                activeTab === 'json' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Raw Spec
            </button>
          </div>

          <button
            onClick={handleDownloadZip}
            title="Download Source Bundle"
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors border border-zinc-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-4">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-zinc-500">Build Status</span>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <span>✓</span>
                  <span>{buildStatus.toUpperCase()}</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-zinc-500">Debug Attempts</span>
                <div className="text-xs font-semibold text-zinc-200 font-mono">
                  {debugAttempts} auto-repairs
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-zinc-500">Pages Generated</span>
                <div className="text-xs font-semibold text-zinc-200 font-mono">
                  {pages.length} Pages
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-zinc-500">Project Files</span>
                <div className="text-xs font-semibold text-zinc-200 font-mono">
                  {files.length > 0 ? `${files.length} Files` : '14 Files'}
                </div>
              </div>
            </div>

            {/* Summary description */}
            {siteSpec.summary && (
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                <p>{siteSpec.summary}</p>
              </div>
            )}

            {/* Generated Pages Checklist */}
            <div className="rounded-xl border border-zinc-800 bg-black/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Generated Store Pages
                </h4>
                <span className="text-[10px] font-mono text-zinc-500">Next.js 14 App Router</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pages.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 text-xs">✓</span>
                      <span className="text-xs font-medium text-zinc-200">{p.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">{p.path}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                onClick={() => setActiveTab('preview')}
                className="px-4 py-2 rounded-lg bg-[#d97706] hover:bg-[#b45309] text-black font-extrabold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center gap-1.5"
              >
                <span>Live Store Sandbox →</span>
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs uppercase tracking-wider transition-colors border border-zinc-700 flex items-center gap-1.5"
              >
                <span>Browse Source Code</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE STORE SANDBOX */}
        {activeTab === 'preview' && (
          <div className="rounded-xl border border-zinc-800 overflow-hidden bg-[#09090b]">
            {/* Browser frame header */}
            <div className="px-4 py-2.5 bg-[#18181b] border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <div className="px-3 py-0.5 rounded bg-black/60 border border-zinc-800 text-[11px] font-mono text-zinc-400">
                  https://{brand.toLowerCase().replace(/\s+/g, '')}.store/{sandboxPage === 'home' ? '' : sandboxPage}
                </div>
              </div>

              {/* Sandbox Page Navigation & Cart Indicator */}
              <div className="flex items-center gap-2">
                <div className="flex bg-black/40 rounded-lg p-0.5 border border-zinc-800 text-[10px]">
                  <button
                    onClick={() => setSandboxPage('home')}
                    className={`px-2 py-0.5 rounded transition-colors ${sandboxPage === 'home' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Home
                  </button>
                  <button
                    onClick={() => setSandboxPage('products')}
                    className={`px-2 py-0.5 rounded transition-colors ${sandboxPage === 'products' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Products
                  </button>
                  <button
                    onClick={() => setSandboxPage('cart')}
                    className={`px-2 py-0.5 rounded transition-colors ${sandboxPage === 'cart' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Cart ({cartCount})
                  </button>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 hidden sm:inline">● Live Prototype</span>
              </div>
            </div>

            {/* Notification toast */}
            {lastAddedItem && (
              <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-4 py-1.5 text-emerald-300 text-xs flex items-center justify-between">
                <span>✓ Added &ldquo;{lastAddedItem}&rdquo; to Cart</span>
                <span className="font-mono text-[10px]">Cart total: {cartCount}</span>
              </div>
            )}

            {/* Interactive Store View */}
            <div className="p-6 space-y-8 bg-[#09090b] text-[#fafafa] max-h-[500px] overflow-y-auto">
              {/* Store Hero */}
              <div className="p-8 rounded-2xl bg-[#18181b] border border-[#27272a] space-y-4">
                <span className="px-3 py-1 rounded-full text-[10px] font-mono uppercase bg-[#d97706]/20 text-[#f59e0b] border border-[#d97706]/40">
                  New Drop Active
                </span>
                <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
                  {brand} <span className="text-[#f59e0b]">Signature</span> Series
                </h1>
                <p className="text-xs text-zinc-300 max-w-lg leading-relaxed">
                  {siteSpec.requirements?.brandStory ||
                    `Engineered for high performance and modern style. Designed to deliver premium comfort and unmatched durability.`}
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setSandboxPage('products')}
                    className="px-4 py-2 rounded-lg bg-[#d97706] text-black font-extrabold text-xs uppercase hover:bg-[#b45309] transition-colors"
                  >
                    Shop Collection
                  </button>
                  <button
                    onClick={() => setSandboxPage('cart')}
                    className="px-4 py-2 rounded-lg bg-zinc-800 text-white font-bold text-xs uppercase border border-zinc-700 hover:bg-zinc-700 transition-colors"
                  >
                    View Cart ({cartCount})
                  </button>
                </div>
              </div>

              {/* Product Cards Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                    {sandboxPage === 'products' ? 'All Products' : 'Featured Releases'}
                  </h3>
                  <span className="text-[11px] text-[#f59e0b] font-mono">{catalogProducts.length} Items in Catalogue</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {catalogProducts.map((p, i) => (
                    <div key={p.id || i} className="rounded-xl bg-[#18181b] border border-[#27272a] overflow-hidden p-3 space-y-3 shadow-md flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="aspect-square rounded-lg overflow-hidden bg-black/40">
                          <img src={p.img} alt={p.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-zinc-400">
                            <span className="font-mono uppercase">{p.tag}</span>
                            <span className="text-[#f59e0b]">{p.rating}</span>
                          </div>
                          <h4 className="font-semibold text-xs text-white truncate mt-0.5" title={p.name}>{p.name}</h4>
                          {p.description && (
                            <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5">{p.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                        <span className="font-mono font-bold text-white text-xs">{p.price}</span>
                        <button
                          onClick={() => handleAddToCart(p.name)}
                          className="px-2.5 py-1 rounded bg-[#d97706] hover:bg-[#b45309] text-black font-extrabold text-[10px] uppercase transition-colors"
                        >
                          Add +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SOURCE FILES EXPLORER */}
        {activeTab === 'files' && (
          <div className="grid grid-cols-1 md:grid-cols-12 rounded-xl border border-zinc-800 overflow-hidden bg-black/40">
            {/* File Sidebar */}
            <div className="md:col-span-4 bg-[#18181b] border-r border-zinc-800 p-2 space-y-1 max-h-[420px] overflow-y-auto">
              <span className="text-[10px] font-mono uppercase text-zinc-500 px-2 py-1 block">
                Project Files ({files.length})
              </span>
              {files.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedFileIdx(idx)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-between ${
                    selectedFileIdx === idx
                      ? 'bg-[#d97706]/15 text-[#f59e0b] border border-[#d97706]/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <span className="truncate">{file.path}</span>
                  <span className="text-[9px] text-zinc-500">
                    {file.path.endsWith('.tsx') ? 'TSX' : file.path.endsWith('.ts') ? 'TS' : 'JSON'}
                  </span>
                </button>
              ))}
            </div>

            {/* Code Viewer */}
            <div className="md:col-span-8 flex flex-col bg-[#09090b] min-h-[420px] max-h-[420px]">
              {selectedFile ? (
                <>
                  <div className="px-4 py-2 bg-[#121216] border-b border-zinc-800 flex items-center justify-between">
                    <span className="text-xs font-mono text-zinc-300 truncate">{selectedFile.path}</span>
                    <button
                      onClick={handleCopyFile}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] border border-zinc-700 transition-colors"
                    >
                      {copiedFile ? '✓ Copied' : 'Copy File'}
                    </button>
                  </div>
                  <pre className="p-4 text-[11px] font-mono text-emerald-400 overflow-auto flex-1 leading-relaxed">
                    {selectedFile.content}
                  </pre>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
                  Select a file from the sidebar to inspect its source code.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: RAW SPEC JSON */}
        {activeTab === 'json' && (
          <div className="relative">
            <button
              onClick={handleCopyJson}
              className="absolute top-2 right-2 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] rounded border border-zinc-700 transition-colors"
            >
              {copiedJson ? '✓ Copied' : 'Copy JSON'}
            </button>
            <pre className="p-3.5 bg-black/80 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[380px]">
              {rawJson || JSON.stringify(spec, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
