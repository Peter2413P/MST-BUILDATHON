'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { getAgents } from '@/lib/api';
import type { Agent } from '@/lib/types';

const SKILL_ICONS: Record<string, string> = {
  summarizer: 'summarize',
  'code-review': 'terminal',
  research: 'manage_search',
  translate: 'translate',
  sentiment: 'psychology',
  sql: 'database',
  chart: 'bar_chart',
  extract: 'dataset',
  'legal-review': 'verified_user',
  finance: 'trending_up',
  transcribe: 'graphic_eq',
  'fact-check': 'fact_check',
};

const CATEGORIES = [
  'All',
  'Research',
  'Security & Audit',
  'Market Intelligence',
  'Data Synthesis',
  'DeFi Execution',
  'Code & Dev',
];

function getCategoryForAgent(agent: Agent): string {
  const s = (agent.skill || '').toLowerCase();
  if (s.includes('research') || s.includes('fact')) return 'Research';
  if (s.includes('code') || s.includes('legal')) return 'Security & Audit';
  if (s.includes('sentiment') || s.includes('finance')) return 'Market Intelligence';
  if (s.includes('extract') || s.includes('summarizer') || s.includes('translate')) return 'Data Synthesis';
  if (s.includes('sql') || s.includes('chart')) return 'Code & Dev';
  return 'Research';
}

function truncAddr(a: string) {
  if (!a || a.length < 12) return a;
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('popularity');

  useEffect(() => {
    getAgents()
      .then(setAgents)
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredAgents = useMemo(() => {
    return agents
      .filter((agent) => {
        const cat = getCategoryForAgent(agent);
        if (selectedCategory !== 'All' && cat !== selectedCategory) return false;
        if (search) {
          const q = search.toLowerCase();
          const match =
            agent.name.toLowerCase().includes(q) ||
            agent.skill.toLowerCase().includes(q) ||
            agent.description.toLowerCase().includes(q);
          if (!match) return false;
        }
        if (qualityFilter === '95' && agent.avg_quality < 0.95) return false;
        if (qualityFilter === '98' && agent.avg_quality < 0.98) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') return b.avg_quality - a.avg_quality;
        if (sortBy === 'stake') return b.bond_amount - a.bond_amount;
        return b.total_jobs - a.total_jobs;
      });
  }, [agents, selectedCategory, search, qualityFilter, sortBy]);

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('All');
    setQualityFilter('all');
    setSortBy('popularity');
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-label-code bg-[#e2f3be] dark:bg-[#B8FF00]/15 text-[#2d5000] dark:text-[#B8FF00] font-semibold border border-[#d2e8aa] dark:border-[#B8FF00]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00] animate-pulse" />
              {agents.length || 12} Verified Agents
            </span>
            <span className="font-label-code text-xs text-[#757872]">/</span>
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489]">Route: /marketplace</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#121511] dark:text-[#F5F7F2] mt-1">
            Agent Marketplace
          </h1>
          <p className="text-sm text-[#525a4e] dark:text-[#8E9489] max-w-2xl">
            Discover verified AI agents, inspect bonded stakes, and hire autonomous workers with on-chain guarantees.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#151814] text-[#121511] dark:text-[#F5F7F2] hover:bg-[#eaf5e6] dark:hover:bg-[#1D211B] transition-colors text-xs font-semibold border border-[#dae6d4] dark:border-[#292E27] shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">group_add</span>
            <span>Assemble Squad</span>
          </Link>
        </div>
      </div>

      {/* Filter & Controls Toolbar */}
      <div className="flex flex-col gap-3 p-3 rounded-xl bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] shadow-sm">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full lg:flex-1 flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-[#757872] dark:text-[#8E9489] text-[20px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by agent name, capability, or keyword..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#f8fbf6] dark:bg-[#11130F] text-[#121511] dark:text-[#F5F7F2] placeholder-[#757872] text-sm border border-[#dae6d4] dark:border-[#292E27] focus:outline-none focus:border-[#3d6a00] dark:focus:border-[#B8FF00] transition-colors"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#f8fbf6] dark:bg-[#11130F] text-[#121511] dark:text-[#F5F7F2] font-label-code text-xs border border-[#dae6d4] dark:border-[#292E27] focus:outline-none focus:border-[#3d6a00] cursor-pointer"
            >
              <option value="all">Quality: All</option>
              <option value="95">Quality &gt; 95%</option>
              <option value="98">Quality &gt; 98%</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#f8fbf6] dark:bg-[#11130F] text-[#121511] dark:text-[#F5F7F2] font-label-code text-xs border border-[#dae6d4] dark:border-[#292E27] focus:outline-none focus:border-[#3d6a00] cursor-pointer"
            >
              <option value="popularity">Sort: Popularity</option>
              <option value="rating">Sort: Quality Score</option>
              <option value="stake">Sort: Stake Bond</option>
            </select>

            <button
              onClick={resetFilters}
              title="Reset Filters"
              className="p-2 rounded-lg text-[#525a4e] dark:text-[#8E9489] hover:text-[#121511] dark:hover:text-white hover:bg-[#eaf5e6] dark:hover:bg-[#1D211B] transition-colors border border-[#dae6d4] dark:border-[#292E27]"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-[#f0f4ee] dark:border-[#292E27] custom-scroll pb-1">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-3 py-1 rounded-full font-label-code text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-[#e2f3be] dark:bg-[#B8FF00] text-[#121511] dark:text-black shadow-sm border border-[#d2e8aa] dark:border-[#B8FF00]'
                    : 'text-[#525a4e] dark:text-[#8E9489] hover:text-[#121511] dark:hover:text-white hover:bg-[#eaf5e6] dark:hover:bg-[#1D211B]'
                }`}
              >
                {cat === 'All' ? `All (${agents.length})` : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Agent Counter Status Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-[#525a4e] dark:text-[#8E9489] font-label-code text-xs">
          <span>Showing</span>
          <span className="font-metric-num font-bold text-[#121511] dark:text-[#F5F7F2]">
            {filteredAgents.length}
          </span>
          <span>autonomous workers</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#525a4e] dark:text-[#8E9489] font-label-code text-[11px]">
          <span className="material-symbols-outlined text-[15px] text-[#3d6a00] dark:text-[#B8FF00]">lock</span>
          <span>Staking Guarantee Verified</span>
        </div>
      </div>

      {/* Agent Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-xl bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] animate-pulse"
            />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#151814] rounded-xl border border-[#dae6d4] dark:border-[#292E27] text-xs font-label-code text-[#757872]">
          No agents match the current filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAgents.map((agent, index) => {
            const category = getCategoryForAgent(agent);
            const icon = SKILL_ICONS[agent.skill] || 'neurology';
            const price = agent.price_mstc ?? agent.price_usdc;
            const qualityPct = (agent.avg_quality * 100).toFixed(1);

            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="group flex flex-col justify-between p-5 rounded-xl bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] hover:border-[#a8f000] dark:hover:border-[#B8FF00] hover:shadow-md transition-all duration-200 shadow-sm"
              >
                <div>
                  {/* Top Details */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#f0f7ed] dark:bg-[#1D211B] flex items-center justify-center text-[#3d6a00] dark:text-[#B8FF00] border border-[#dae6d4] dark:border-[#292E27]">
                        <span className="material-symbols-outlined text-[26px]">{icon}</span>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-base text-[#121511] dark:text-[#F5F7F2] group-hover:text-[#3d6a00] dark:group-hover:text-[#B8FF00] transition-colors">
                            {agent.name}
                          </span>
                          <span className="material-symbols-outlined text-[#3d6a00] dark:text-[#B8FF00] text-[16px]">
                            verified
                          </span>
                        </div>
                        <span className="font-label-code text-[11px] text-[#757872] dark:text-[#8E9489]">
                          {truncAddr(agent.wallet_address)} • v2.1.0
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full font-label-code text-[11px] border border-[#d2e8aa] dark:border-[#B8FF00]/30 bg-[#eaf5e6] dark:bg-[#B8FF00]/15 text-[#2d5000] dark:text-[#B8FF00] font-semibold shrink-0">
                      {category}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#525a4e] dark:text-[#8E9489] leading-relaxed mb-3 line-clamp-2">
                    {agent.description}
                  </p>

                  {/* Metrics Box */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#f8fbf6] dark:bg-[#11130F] border border-[#dae6d4] dark:border-[#292E27] mb-3">
                    <div className="flex flex-col">
                      <span className="font-label-code text-[10px] text-[#757872] dark:text-[#8E9489] uppercase">
                        Quality Score
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[#d9822b] text-[14px]">star</span>
                        <span className="font-metric-num text-xs font-bold text-[#121511] dark:text-[#F5F7F2]">
                          {qualityPct}%
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-code text-[10px] text-[#757872] dark:text-[#8E9489] uppercase">
                        Execution History
                      </span>
                      <span className="font-metric-num text-xs font-bold text-[#121511] dark:text-[#F5F7F2] mt-0.5">
                        {agent.total_jobs.toLocaleString()} jobs
                      </span>
                    </div>
                  </div>
                </div>

                {/* Price & Actions Footer */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#f0f4ee] dark:border-[#292E27]">
                  <div className="flex flex-col">
                    <span className="font-label-code text-[10px] text-[#757872] dark:text-[#8E9489] uppercase">
                      Fixed Rate
                    </span>
                    <div className="font-metric-num text-sm font-bold text-[#121511] dark:text-[#F5F7F2]">
                      {price}{' '}
                      <span className="font-label-code text-xs text-[#3d6a00] dark:text-[#B8FF00]">
                        MSTC
                      </span>{' '}
                      <span className="text-[10px] text-[#757872] font-normal">/ {agent.price_unit}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/agents/${agent.id}`}
                      className="px-3 py-1.5 rounded-lg border border-[#dae6d4] dark:border-[#292E27] text-[#121511] dark:text-[#F5F7F2] text-xs font-medium hover:bg-[#f0f7ed] dark:hover:bg-[#1D211B] transition-colors"
                    >
                      Profile
                    </Link>
                    <Link
                      href={`/agents/${agent.id}/hire`}
                      className="px-4 py-1.5 rounded-lg bg-[#a8f000] dark:bg-[#B8FF00] hover:bg-[#9de000] text-black font-bold text-xs shadow-sm transition-all"
                    >
                      Hire
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
