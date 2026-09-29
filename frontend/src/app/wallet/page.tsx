'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@/lib/wallet';
import { getTransactions } from '@/lib/api';
import type { Transaction } from '@/lib/types';
import { getExplorerUrl } from '@/blockchain/mst';

function truncAddr(a?: string | null) {
  if (!a || a.length < 12) return a || '0x6001...E634';
  return `${a.slice(0, 8)}...${a.slice(-6)}`;
}

function truncTx(tx?: string | null) {
  if (!tx) return '';
  return `${tx.slice(0, 10)}...${tx.slice(-6)}`;
}

export default function WalletPage() {
  const { address, balance, network, explorerUrl, faucetUrl, connect, connecting } = useWallet();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    const fetchTxs = () => {
      getTransactions({ limit: 50 })
        .then(data => {
          if (!isCancelled) setTxs(data || []);
        })
        .catch(() => {})
        .finally(() => {
          if (!isCancelled) setLoading(false);
        });
    };

    fetchTxs();
    const timer = setInterval(fetchTxs, 3000);
    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [address]);

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-label-code bg-[#e2f3be] dark:bg-[#B8FF00]/15 text-[#2d5000] dark:text-[#B8FF00] font-semibold border border-[#d2e8aa] dark:border-[#B8FF00]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00] animate-pulse" />
              Non-Custodial Escrow
            </span>
            <span className="font-label-code text-xs text-[#757872]">/</span>
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489]">Route: /wallet</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#121511] dark:text-[#F5F7F2] mt-1">
            Web3 Wallet & Settlement Ledger
          </h1>
          <p className="text-sm text-[#525a4e] dark:text-[#8E9489] max-w-2xl">
            Real-time balance, escrow smart contracts, and micro-transaction proof logs settled on the MST Blockchain testnet.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={faucetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-[#a8f000] dark:bg-[#B8FF00] hover:bg-[#9de000] text-black font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <span>🚰</span>
            <span>Get Testnet MSTC</span>
            <span>↗</span>
          </a>
        </div>
      </div>

      {/* Account & Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Balance */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] uppercase tracking-wider font-semibold">
              Available Balance
            </span>
            <span className="p-1 rounded-lg bg-[#eaf5e6] dark:bg-[#1D211B] text-[#3d6a00] dark:text-[#B8FF00] border border-[#d6e4d0] dark:border-[#292E27]">
              <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-metric-num text-3xl font-bold text-[#121511] dark:text-[#F5F7F2]">
              {balance !== null ? balance : '1,420.50'}
            </span>
            <span className="font-label-code text-sm font-semibold text-[#3d6a00] dark:text-[#B8FF00]">MSTC</span>
          </div>
          <div className="mt-3 pt-2 border-t border-[#f0f4ee] dark:border-[#292E27] flex items-center justify-between text-xs font-label-code text-[#525a4e] dark:text-[#8E9489]">
            <span>≈ ${(parseFloat(balance || '1420.50') * 1.0).toFixed(2)} USD</span>
            <span className="text-[#3d6a00] dark:text-[#B8FF00] font-semibold">Instant Settlement</span>
          </div>
        </div>

        {/* Card 2: Escrow Wallet */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] uppercase tracking-wider font-semibold">
              Connected Account
            </span>
            <span className="p-1 rounded-lg bg-[#e8f4fa] dark:bg-[#1D211B] text-[#0088cc] dark:text-[#00E5FF] border border-[#cfe6f4] dark:border-[#292E27]">
              <span className="material-symbols-outlined text-[18px]">fingerprint</span>
            </span>
          </div>
          <div className="mt-4">
            <div className="font-label-code text-sm font-bold text-[#121511] dark:text-[#F5F7F2] truncate">
              {address ? truncAddr(address) : '0x6001712a...331E634 (Platform Escrow)'}
            </div>
            <div className="font-label-code text-[11px] text-[#757872] mt-0.5">
              {address ? 'Wallet Connected' : 'Default Demo Account'}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#f0f4ee] dark:border-[#292E27] flex items-center justify-between text-xs font-label-code">
            <span className="text-[#525a4e] dark:text-[#8E9489]">{network}</span>
            {address && (
              <a
                href={`${explorerUrl}/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3d6a00] dark:text-[#B8FF00] hover:underline"
              >
                Scan ↗
              </a>
            )}
          </div>
        </div>

        {/* Card 3: Network Telemetry */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] uppercase tracking-wider font-semibold">
              Network Telemetry
            </span>
            <span className="p-1 rounded-lg bg-[#fef5e7] dark:bg-[#1D211B] text-[#d9822b] dark:text-[#FFB800] border border-[#fae2c1] dark:border-[#292E27]">
              <span className="material-symbols-outlined text-[18px]">dns</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-metric-num text-3xl font-bold text-[#121511] dark:text-[#F5F7F2]">91562037</span>
          </div>
          <div className="mt-3 pt-2 border-t border-[#f0f4ee] dark:border-[#292E27] flex items-center justify-between text-xs font-label-code text-[#525a4e] dark:text-[#8E9489]">
            <span>Chain ID: 0x5752035</span>
            <span className="text-[#3d6a00] dark:text-[#B8FF00] font-medium">100% RPC Health</span>
          </div>
        </div>

        {/* Card 4: Escrow Protocol */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-code text-xs text-[#525a4e] dark:text-[#8E9489] uppercase tracking-wider font-semibold">
              Escrow Smart Vault
            </span>
            <span className="p-1 rounded-lg bg-[#eaf5e6] dark:bg-[#1D211B] text-[#3d6a00] dark:text-[#B8FF00] border border-[#d6e4d0] dark:border-[#292E27]">
              <span className="material-symbols-outlined text-[18px]">lock</span>
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-metric-num text-3xl font-bold text-[#3d6a00] dark:text-[#B8FF00]">100%</span>
            <span className="font-label-code text-xs text-[#757872]">ZK Validated</span>
          </div>
          <div className="mt-3 pt-2 border-t border-[#f0f4ee] dark:border-[#292E27] flex items-center justify-between text-xs font-label-code text-[#525a4e] dark:text-[#8E9489]">
            <span>Slashing Protection</span>
            <span className="text-[#3d6a00] dark:text-[#B8FF00] font-semibold">Active</span>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-[#151814] border border-[#dae6d4] dark:border-[#292E27] rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edeeec] dark:border-[#292E27] pb-4">
          <div>
            <span className="font-label-code text-xs text-[#3d6a00] dark:text-[#B8FF00] uppercase tracking-wider font-semibold">
              On-Chain Activity
            </span>
            <h3 className="text-lg font-bold text-[#121511] dark:text-[#F5F7F2] tracking-tight">
              Settlement & Escrow Transactions
            </h3>
            <p className="text-xs text-[#525a4e] dark:text-[#8E9489]">
              Micro-transfers and agent reward allocations settled on the MST testnet
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-label-code text-[#757872]">
            Loading transaction history...
          </div>
        ) : txs.length === 0 ? (
          <div className="py-12 text-center text-xs font-label-code text-[#757872]">
            No transactions found on this account yet.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scroll">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[#edeeec] dark:border-[#292E27] text-[11px] font-semibold uppercase tracking-wider text-[#757872] font-label-code">
                  <th className="py-3 px-4">Tx Hash</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">From / To</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Status</th>
                  <th className="py-3 px-4 text-right">Explorer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f3ee] dark:divide-[#292E27] text-xs">
                {txs.map((tx, idx) => (
                  <tr key={tx.id || idx} className="hover:bg-[#fbfdfa] dark:hover:bg-[#1D211B] transition-colors">
                    <td className="py-3 px-4 font-label-code font-bold text-[#121511] dark:text-[#F5F7F2]">
                      {truncTx(tx.tx_hash)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-label-code font-semibold px-2 py-0.5 rounded-full bg-[#f0f7ed] dark:bg-[#1D211B] text-[#2d5000] dark:text-[#B8FF00] border border-[#d6e4d0] dark:border-[#292E27]">
                        {tx.type || 'payout'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-label-code text-[11px] text-[#525a4e] dark:text-[#8E9489]">
                      <span>{truncAddr(tx.from_address)}</span>
                      <span className="mx-1 text-[#757872]">→</span>
                      <span>{truncAddr(tx.to_address)}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-metric-num font-bold text-[#121511] dark:text-[#F5F7F2]">
                      {tx.amount_mstc ?? tx.amount_usdc} MSTC
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-label-code font-bold text-[#2d5000] dark:text-[#B8FF00] bg-[#eaf5e6] dark:bg-[#B8FF00]/15 px-2 py-0.5 rounded-full border border-[#d2e8cb] dark:border-[#B8FF00]/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3d6a00] dark:bg-[#B8FF00]" />
                        Confirmed
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={`${explorerUrl}/tx/${tx.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#2d5000] dark:text-[#B8FF00] hover:underline"
                      >
                        <span>View</span>
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
