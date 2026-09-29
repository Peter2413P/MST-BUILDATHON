'use client';

import React, { useState, useMemo } from 'react';
import type { ShoppingRecommendationArtifact, RankedProduct } from '@/lib/server/shopping/types';

interface ShoppingRendererProps {
  spec?: ShoppingRecommendationArtifact | unknown;
  rawJson?: string;
  title?: string;
}

export default function ShoppingRenderer({ spec, rawJson, title }: ShoppingRendererProps) {
  const data: ShoppingRecommendationArtifact | null = useMemo(() => {
    if (spec && typeof spec === 'object' && 'type' in spec && (spec as any).type === 'shopping') {
      return spec as ShoppingRecommendationArtifact;
    }
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        if (parsed.type === 'shopping' || parsed.rankedProducts || parsed.conflictDetails) {
          return parsed as ShoppingRecommendationArtifact;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  }, [spec, rawJson]);

  // State for sorting & filtering
  const [sortBy, setSortBy] = useState<'recommended' | 'price_asc' | 'price_desc' | 'rating'>('recommended');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [comparingIds, setComparingIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);

  if (!data) {
    return (
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm">
        Invalid shopping data deliverable.
      </div>
    );
  }

  // Handle Conflict Scenario (e.g. "No laptop over ₹60,000. I need RTX 4070.")
  if (data.status === 'conflict' || data.status === 'no_matches') {
    const details = data.conflictDetails;
    return (
      <div className="space-y-4 my-4">
        <div className="p-6 rounded-2xl bg-amber-950/20 border border-amber-800/40 text-zinc-100">
          <div className="flex items-center gap-3 mb-3">
            <span className="p-2 rounded-lg bg-amber-500/20 text-amber-400 font-semibold text-xs tracking-wider uppercase">
              Requirement Conflict
            </span>
            <span className="text-xs text-zinc-400 font-mono">Status: No Satisfying Products Found</span>
          </div>

          <h3 className="text-base font-semibold text-amber-200 mb-2">
            {details?.message || 'No products were found that satisfy all specified requirements.'}
          </h3>

          {details?.relaxationSuggestions && details.relaxationSuggestions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-amber-900/30">
              <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Recommended Actions to Resolve:
              </p>
              <ul className="space-y-2">
                {details.relaxationSuggestions.map((sug, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                    <span className="text-amber-400 font-bold">→</span>
                    <span>{sug}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.rejectedProducts && data.rejectedProducts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-amber-900/30">
              <p className="text-xs font-semibold text-zinc-400 mb-2">
                Evaluated options that exceeded constraints:
              </p>
              <div className="space-y-2">
                {data.rejectedProducts.slice(0, 3).map((rej, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                    <div className="flex justify-between font-medium text-zinc-200">
                      <span>{rej.title}</span>
                      <span className="text-zinc-400">₹{rej.price.toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] text-amber-400/90 mt-1">
                      Reason: {rej.rejectionReasons.join('; ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const allRanked = data.rankedProducts || [];

  // Brands for filter dropdown
  const availableBrands = useMemo(() => {
    const bSet = new Set<string>();
    allRanked.forEach(item => bSet.add(item.product.brand));
    return Array.from(bSet);
  }, [allRanked]);

  // Filtered & Sorted items
  const displayItems = useMemo(() => {
    let items = [...allRanked];
    if (selectedBrand !== 'all') {
      items = items.filter(i => i.product.brand.toLowerCase() === selectedBrand.toLowerCase());
    }

    if (sortBy === 'price_asc') {
      items.sort((a, b) => a.product.lowestPriceOffer.price - b.product.lowestPriceOffer.price);
    } else if (sortBy === 'price_desc') {
      items.sort((a, b) => b.product.lowestPriceOffer.price - a.product.lowestPriceOffer.price);
    } else if (sortBy === 'rating') {
      items.sort((a, b) => b.product.reviews.rating - a.product.reviews.rating);
    } else {
      // Default: recommended (overall score)
      items.sort((a, b) => b.scores.overallScore - a.scores.overallScore);
    }

    return items;
  }, [allRanked, selectedBrand, sortBy]);

  const toggleCompare = (id: string) => {
    setComparingIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const comparedProducts = useMemo(() => {
    return allRanked.filter(i => comparingIds.includes(i.product.id));
  }, [allRanked, comparingIds]);

  return (
    <div className="w-full space-y-6 my-4 font-sans text-zinc-100">
      {/* ── Top Header & Provenance Banner ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium tracking-wide">
              REAL DATA VERIFIED
            </span>
            <span className="text-xs text-zinc-400">
              {data.shortlistedCount} verified options discovered
            </span>
          </div>
          <h2 className="text-base font-semibold text-zinc-100 mt-1">
            {title || data.query || 'Shopping Recommendations'}
          </h2>
        </div>

        {/* Controls: Filter & Sort */}
        <div className="flex flex-wrap items-center gap-2">
          {availableBrands.length > 1 && (
            <select
              value={selectedBrand}
              onChange={e => setSelectedBrand(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Brands ({availableBrands.length})</option>
              {availableBrands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="recommended">Sort: Recommended (Score)</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Highest Customer Rating</option>
          </select>

          {comparingIds.length > 0 && (
            <button
              onClick={() => setShowCompareModal(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-md flex items-center gap-1.5"
            >
              <span>Compare ({comparingIds.length}/3)</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Product Cards Grid ── */}
      <div className="grid grid-cols-1 gap-6">
        {displayItems.map((item, idx) => {
          const p = item.product;
          const bestOffer = p.lowestPriceOffer;
          const isComparing = comparingIds.includes(p.id);

          return (
            <div
              key={p.id || idx}
              className={`relative rounded-2xl bg-zinc-900 border transition-all duration-200 overflow-hidden shadow-xl ${
                item.rank === 1
                  ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                  : 'border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              {/* Rank Banner */}
              {item.rank === 1 && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-600 to-emerald-500 text-white text-[11px] font-bold px-3 py-1 rounded-bl-xl shadow-md z-10">
                  TOP PICK · #{item.rank} MATCH
                </div>
              )}

              <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left: Product Image & Quick Meta (3 cols) */}
                <div className="md:col-span-4 flex flex-col justify-between">
                  <div className="relative aspect-[4/3] rounded-xl bg-zinc-800/80 border border-zinc-700/50 overflow-hidden flex items-center justify-center group">
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      onError={e => {
                        (e.target as any).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-medium text-emerald-400 border border-white/10">
                      REAL DATA · {bestOffer.retailer}
                    </div>
                  </div>

                  {/* Rating & Compare Checkbox */}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                      <span>★ {p.reviews.rating.toFixed(1)}</span>
                      <span className="text-zinc-400 font-normal">
                        ({p.reviews.reviewCount.toLocaleString()} reviews)
                      </span>
                    </div>

                    <button
                      onClick={() => toggleCompare(p.id)}
                      className={`text-xs px-2 py-1 rounded border transition ${
                        isComparing
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {isComparing ? '✓ Comparing' : '+ Compare'}
                    </button>
                  </div>
                </div>

                {/* Right: Details, Specs, Price, Review Analysis (8 cols) */}
                <div className="md:col-span-8 flex flex-col justify-between space-y-4">
                  {/* Title & Brand */}
                  <div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
                      <span className="font-semibold text-zinc-300">{p.brand}</span>
                      <span>•</span>
                      <span>Model: {p.model}</span>
                    </div>
                    <h3 className="text-base font-semibold text-zinc-100 leading-snug">
                      {p.title}
                    </h3>
                  </div>

                  {/* Price & Retailer Highlights */}
                  <div className="flex flex-wrap items-baseline gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                    <span className="text-2xl font-bold text-emerald-400">
                      ₹{bestOffer.price.toLocaleString()}
                    </span>
                    {bestOffer.originalPrice && (
                      <span className="text-sm line-through text-zinc-500">
                        ₹{bestOffer.originalPrice.toLocaleString()}
                      </span>
                    )}
                    {bestOffer.discountPct && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        {bestOffer.discountPct}% OFF
                      </span>
                    )}
                    <span className="text-xs text-zinc-400 ml-auto">
                      Available on <strong className="text-zinc-200">{bestOffer.retailer}</strong>
                    </span>
                  </div>

                  {/* Why it matches checklist (Requirements) */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                      Why it matches your requirements:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {item.whyItMatches.map((m, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-300">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span>{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Review Pros & Cons (Verified Review Insights) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-xs">
                    <div>
                      <span className="font-semibold text-emerald-400 block mb-1">Verified Positives:</span>
                      <ul className="space-y-1 text-zinc-300">
                        {p.reviews.positiveThemes.slice(0, 2).map((pos, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-emerald-400">•</span>
                            <span>{pos}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-semibold text-amber-400 block mb-1">Important Drawbacks:</span>
                      <ul className="space-y-1 text-zinc-400">
                        {p.reviews.negativeThemes.slice(0, 2).map((neg, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-amber-400">•</span>
                            <span>{neg}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Multi-Store Price Comparison breakdown if available */}
                  {p.offers.length > 1 && (
                    <div className="p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/40 text-xs">
                      <span className="font-semibold text-zinc-300 block mb-1.5">
                        Connected Retailer Price Comparison:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {p.offers.map((offer, i) => (
                          <a
                            key={i}
                            href={offer.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition ${
                              offer.retailer === bestOffer.retailer
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                                : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            <span>{offer.retailer}: ₹{offer.price.toLocaleString()}</span>
                            {offer.retailer === bestOffer.retailer && (
                              <span className="text-[10px] text-emerald-400 font-bold">(Lowest)</span>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Score Breakdown & View Product Action */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-800/80">
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <div>
                        Score: <strong className="text-zinc-200">{item.scores.overallScore}/100</strong>
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        Match: {item.scores.requirementMatch}% · Value: {item.scores.valueScore}% · Reviews: {item.scores.reviewScore}%
                      </div>
                    </div>

                    <a
                      href={bestOffer.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold tracking-wide transition text-center shadow-lg"
                    >
                      View on {bestOffer.retailer} →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Side-by-Side Comparison Modal ── */}
      {showCompareModal && comparedProducts.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-semibold text-zinc-100">
                Product Comparison ({comparedProducts.length} Items)
              </h3>
              <button
                onClick={() => setShowCompareModal(false)}
                className="text-zinc-400 hover:text-zinc-100 text-sm font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {comparedProducts.map(item => (
                <div key={item.product.id} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                  <div className="aspect-[4/3] rounded-lg overflow-hidden bg-zinc-800">
                    <img src={item.product.imageUrl} alt={item.product.title} className="w-full h-full object-cover" />
                  </div>
                  <h4 className="text-xs font-semibold text-zinc-200 line-clamp-2">{item.product.title}</h4>
                  <div className="text-base font-bold text-emerald-400">
                    ₹{item.product.lowestPriceOffer.price.toLocaleString()}
                  </div>
                  <div className="text-xs text-zinc-400">
                    Rating: {item.product.reviews.rating}★ ({item.product.reviews.reviewCount.toLocaleString()} reviews)
                  </div>
                  <div className="text-xs text-zinc-300 border-t border-zinc-800 pt-2 space-y-1">
                    <p><strong>Brand:</strong> {item.product.brand}</p>
                    {item.product.specifications.gpu && <p><strong>GPU:</strong> {String(item.product.specifications.gpu)}</p>}
                    {item.product.specifications.ram_gb && <p><strong>RAM:</strong> {item.product.specifications.ram_gb}GB</p>}
                    {item.product.specifications.camera_mp && <p><strong>Camera:</strong> {item.product.specifications.camera_mp}MP</p>}
                    {item.product.specifications.battery_mah && <p><strong>Battery:</strong> {item.product.specifications.battery_mah}mAh</p>}
                  </div>
                  <a
                    href={item.product.lowestPriceOffer.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-1.5 text-center bg-zinc-800 hover:bg-zinc-700 text-xs font-medium rounded-lg text-zinc-200"
                  >
                    View Product →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
