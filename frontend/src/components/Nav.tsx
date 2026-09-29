'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { useWallet } from '@/lib/wallet';
import { useTheme } from '@/lib/theme';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
  exact?: boolean;
}

const navItems: NavItem[] = [
  { href: '/',            label: 'Home',         icon: 'hub',                   exact: true },
  { href: '/marketplace', label: 'Marketplace',  icon: 'storefront',            exact: true },
  { href: '/jobs',        label: 'Jobs',         icon: 'task',                  badge: '3 Live', exact: false },
  { href: '/dashboard',   label: 'Dashboard',    icon: 'terminal',              exact: true },
  { href: '/wallet',      label: 'Web3 Wallet',  icon: 'account_balance_wallet',exact: true },
];

function truncAddr(a: string) {
  if (!a || a.length < 10) return a;
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export default function Nav() {
  const path = usePathname();
  const { address, balance, connecting, connect, disconnect, network, explorerUrl, faucetUrl } = useWallet();
  const { theme, toggle } = useTheme();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setWalletDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
    setWalletDropdownOpen(false);
  }, [path]);

  const isDark = theme === 'dark';

  return (
    <>
      {/* ── Desktop Left Sidebar (240px) ───────────────────────────────── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-[240px] bg-[#f2fdeb] dark:bg-[#0B0D0A] z-50 flex-col justify-between p-4 border-r border-[#dae6d4] dark:border-[#292E27] select-none">
        <div className="flex flex-col gap-6">
          {/* Brand Logo & Title */}
          <Link href="/" className="flex items-center gap-2.5 px-1 group">
            <div className="w-8 h-8 rounded-lg bg-[#a8f000] dark:bg-[#B8FF00] flex items-center justify-center text-black font-bold text-sm shadow-sm group-hover:scale-105 transition-transform shrink-0">
              <span className="material-symbols-outlined text-[18px] text-black">polyline</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-base tracking-tight font-bold text-[#121511] dark:text-[#F5F7F2] leading-tight">
                Agent<span className="text-[#3d6a00] dark:text-[#B8FF00]">Mesh</span>
              </span>
              <span className="font-label-code text-[#3d6a00] dark:text-[#B8FF00] uppercase tracking-widest text-[9px] font-bold">
                Decentralized V2.4
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = item.exact ? path === item.href : path.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                    isActive
                      ? 'bg-[#e2f3be] dark:bg-[#B8FF00]/15 text-[#121511] dark:text-[#B8FF00] font-semibold shadow-sm'
                      : 'text-[#525a4e] dark:text-[#8E9489] hover:bg-[#e4ede0] dark:hover:bg-[#1D211B] hover:text-[#121511] dark:hover:text-[#F5F7F2] font-medium'
                  )}
                >
                  <span
                    className={clsx(
                      'material-symbols-outlined text-[18px] w-5 h-5 flex items-center justify-center shrink-0',
                      isActive ? 'text-[#2d5000] dark:text-[#B8FF00]' : 'text-[#757872] dark:text-[#8E9489]'
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={clsx(
                        'ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                        isActive
                          ? 'bg-[#d2e8aa] dark:bg-[#B8FF00]/30 text-[#2d5000] dark:text-[#B8FF00]'
                          : 'bg-[#e1ebd9] dark:bg-[#1D211B] text-[#2d5000] dark:text-[#8E9489]'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Wallet Widget Card */}
        <Link
          href="/wallet"
          className="p-3 rounded-xl bg-[#eaf5e6] dark:bg-[#151814] hover:bg-[#e2f3be]/60 dark:hover:bg-[#1D211B] border border-[#dae6d4] dark:border-[#292E27] flex flex-col gap-1 transition-all group cursor-pointer block shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-label-code bg-[#dcf2cb] dark:bg-[#B8FF00]/15 text-[#244200] dark:text-[#B8FF00] font-medium border border-[#d2e8aa] dark:border-[#B8FF00]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00] animate-pulse" />
              MST Testnet
            </span>
            <span className="material-symbols-outlined text-[#73806e] dark:text-[#8E9489] group-hover:text-[#121511] dark:group-hover:text-[#F5F7F2] text-[16px] w-4 h-4 flex items-center justify-center shrink-0 transition-colors">
              account_balance_wallet
            </span>
          </div>
          <div className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] group-hover:text-[#121511] dark:group-hover:text-[#F5F7F2] mt-1 truncate transition-colors">
            {address ? truncAddr(address) : '0x6001...E634 (Demo)'}
          </div>
          <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-[#d8e8d3] dark:border-[#292E27]">
            <span className="font-metric-num text-[14px] font-bold text-[#121511] dark:text-[#F5F7F2]">
              {balance !== null ? balance : '1,420.50'}
            </span>
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] font-medium">MSTC</span>
          </div>
        </Link>
      </aside>

      {/* ── Top Bar Header (Desktop & Mobile) ───────────────────────── */}
      <header className="fixed top-0 left-0 md:left-[240px] right-0 h-16 z-40 bg-white/95 dark:bg-[#0B0D0A]/95 backdrop-blur-xl border-b border-[#dae6d4] dark:border-[#292E27]">
        <div className="h-16 w-full max-w-[1440px] mx-auto px-4 sm:px-8 flex items-center justify-between gap-4">
          
          {/* Left Mobile Brand + Desktop Telemetry Ticker */}
          <div className="flex items-center gap-3 overflow-x-auto py-1">
            {/* Mobile Logo */}
            <Link href="/" className="md:hidden flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-[#a8f000] dark:bg-[#B8FF00] flex items-center justify-center text-black font-bold text-xs shrink-0">
                <span className="material-symbols-outlined text-[16px]">polyline</span>
              </div>
              <span className="font-bold text-sm text-[#121511] dark:text-white">AgentMesh</span>
            </Link>

            {/* Block Ticker Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#eaf5e6] dark:bg-[#151814] border border-[#d6e4d0] dark:border-[#292E27] shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00] animate-pulse" />
              <span className="font-label-code text-[12px] text-[#41503d] dark:text-[#8E9489] font-medium">
                Block #4,891,024
              </span>
              <span className="text-[#b5c4b0] dark:text-[#292E27]">|</span>
              <span className="font-label-code text-[12px] text-[#2d5000] dark:text-[#B8FF00] font-semibold">
                MST Node Synced
              </span>
            </div>

            {/* Telemetry info */}
            <div className="hidden lg:flex items-center gap-2.5 text-xs text-[#525a4e] dark:text-[#8E9489] shrink-0">
              <span className="text-[#3d6a00] dark:text-[#B8FF00] font-bold">●</span>
              <span>MST Testnet Active · Epoch #419 · Groq LLaMA-3.3-70B</span>
              <span className="text-[#c5c7c0] dark:text-[#292E27]">|</span>
              <span className="font-label-code text-xs text-[#141613] dark:text-[#F5F7F2] bg-[#f0f7ed] dark:bg-[#151814] px-2 py-0.5 rounded border border-[#d6e4d0] dark:border-[#292E27]">
                Consensus: 0x8a92...47bc
              </span>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Faucet Link */}
            <a
              href={faucetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-label-code px-2.5 py-1.5 rounded-lg bg-[#f0f7ed] dark:bg-[#151814] text-[#2d5000] dark:text-[#B8FF00] border border-[#d6e4d0] dark:border-[#292E27] hover:border-[#a8f000] transition-colors"
              title="Get testnet MSTC from official faucet"
            >
              <span>🚰</span>
              <span>Faucet</span>
              <span className="text-[10px]">↗</span>
            </a>

            {/* Dark/Light Theme Toggle */}
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-lg border border-[#dae6d4] dark:border-[#292E27] text-[#121511] dark:text-[#F5F7F2] hover:bg-[#f0f7ed] dark:hover:bg-[#1D211B] transition-colors flex items-center justify-center bg-white dark:bg-[#151814] shadow-sm shrink-0 overflow-hidden"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-[#2d5000] dark:text-[#B8FF00] w-5 h-5 flex items-center justify-center">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Wallet Dropdown / Connect Button */}
            <div className="relative" ref={dropdownRef}>
              {address ? (
                <button
                  onClick={() => setWalletDropdownOpen(!walletDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#dae6d4] dark:border-[#292E27] bg-white dark:bg-[#151814] hover:bg-[#f0f7ed] dark:hover:bg-[#1D211B] text-xs font-label-code text-[#121511] dark:text-[#F5F7F2] shadow-sm transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00] shrink-0" />
                  <span>{truncAddr(address)}</span>
                  <span className="text-[10px] text-[#757872]">▾</span>
                </button>
              ) : (
                <button
                  onClick={connect}
                  disabled={connecting}
                  className="px-3.5 py-1.5 rounded-lg bg-[#a8f000] dark:bg-[#B8FF00] hover:bg-[#9de000] text-black font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px] w-4 h-4 flex items-center justify-center">account_balance_wallet</span>
                  <span>{connecting ? 'Connecting...' : 'Connect Wallet'}</span>
                </button>
              )}

              {/* Wallet Dropdown Menu */}
              {walletDropdownOpen && address && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="p-3 border-b border-[#dae6d4] dark:border-[#292E27] bg-[#f8fbf6] dark:bg-[#1D211B]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-[#757872] font-label-code">MST Blockchain</span>
                      <span className="text-[9px] font-label-code px-1.5 py-0.5 rounded bg-[#dcf2cb] dark:bg-[#B8FF00]/20 text-[#244200] dark:text-[#B8FF00] font-semibold">
                        {network}
                      </span>
                    </div>
                    <div className="text-xs font-label-code font-bold text-[#121511] dark:text-[#F5F7F2] truncate">
                      {address}
                    </div>
                    {balance !== null && (
                      <div className="text-sm font-label-code text-[#3d6a00] dark:text-[#B8FF00] font-bold mt-1">
                        {balance} <span className="text-xs font-normal">MSTC</span>
                      </div>
                    )}
                  </div>
                  <div className="p-1 flex flex-col gap-0.5">
                    <Link
                      href="/wallet"
                      className="flex items-center gap-2 px-3 py-2 text-xs text-[#525a4e] dark:text-[#8E9489] hover:text-[#121511] dark:hover:text-white hover:bg-[#f0f7ed] dark:hover:bg-[#1D211B] rounded-lg transition-colors font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                      <span>Wallet Dashboard</span>
                    </Link>
                    <a
                      href={`${explorerUrl}/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 text-xs text-[#525a4e] dark:text-[#8E9489] hover:text-[#121511] dark:hover:text-white hover:bg-[#f0f7ed] dark:hover:bg-[#1D211B] rounded-lg transition-colors font-medium"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      <span>View on MSTScan</span>
                    </a>
                    <button
                      onClick={() => {
                        disconnect();
                        setWalletDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors font-medium text-left"
                    >
                      <span className="material-symbols-outlined text-[16px]">logout</span>
                      <span>Disconnect Wallet</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Menu Button */}
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="md:hidden w-9 h-9 rounded-lg border border-[#dae6d4] dark:border-[#292E27] text-[#121511] dark:text-white hover:bg-[#f0f7ed] dark:hover:bg-[#1D211B] transition-colors flex items-center justify-center bg-white dark:bg-[#151814]"
              aria-label="Toggle Navigation"
            >
              <span className="material-symbols-outlined text-[20px]">
                {mobileNavOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* ── Mobile Navigation Drawer ───────────────────────────────── */}
        {mobileNavOpen && (
          <div className="md:hidden border-b border-[#dae6d4] dark:border-[#292E27] bg-white dark:bg-[#0B0D0A] px-4 py-3 shadow-xl">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = item.exact ? path === item.href : path.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                      isActive
                        ? 'bg-[#e2f3be] dark:bg-[#B8FF00]/15 text-[#121511] dark:text-[#B8FF00] font-semibold'
                        : 'text-[#525a4e] dark:text-[#8E9489] hover:bg-[#f0f7ed] dark:hover:bg-[#1D211B]'
                    )}
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#d2e8aa] dark:bg-[#B8FF00]/30 text-[#2d5000] dark:text-[#B8FF00]">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="pt-3 mt-3 border-t border-[#dae6d4] dark:border-[#292E27] flex items-center justify-between">
              <div className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489]">
                MST Testnet: <span className="font-bold text-[#121511] dark:text-white">{balance ?? '1,420.50'} MSTC</span>
              </div>
              <a
                href={faucetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#3d6a00] dark:text-[#B8FF00] font-semibold"
              >
                Faucet ↗
              </a>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
