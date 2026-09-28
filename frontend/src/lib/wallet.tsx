'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ACTIVE_NETWORK,
  detectProviders,
  connectWallet as connectEip1193,
  isMstNetwork,
  switchOrAddMstNetwork,
  getBalance as fetchMstcBalance,
  sendPayment as executeMstPayment,
  type DetectedProvider,
  type RawEIP1193Provider,
} from '@/blockchain/mst';

// ── Step state ───────────────────────────────────────────────────────────────
type Step =
  | { kind: 'idle' }
  | { kind: 'picking'; list: DetectedProvider[] }
  | { kind: 'connecting'; p: DetectedProvider }
  | { kind: 'conn-failed'; message: string }
  | { kind: 'need-network'; p: DetectedProvider; addr: string }
  | { kind: 'switching'; p: DetectedProvider; addr: string; adding: boolean }
  | { kind: 'net-failed'; p: DetectedProvider; addr: string; message: string };

// ── Wallet context ───────────────────────────────────────────────────────────
export interface WalletState {
  address: string | null;
  balance: string | null;
  currency: string;
  network: string;
  explorerUrl: string;
  faucetUrl: string;
  connecting: boolean;
  connect: () => void;
  disconnect: () => void;
  sendPayment: (amountMstc: string, description?: string) => Promise<string>;
  refreshBalance: () => Promise<void>;
}

const WalletCtx = createContext<WalletState>({
  address: null,
  balance: null,
  currency: 'MSTC',
  network: 'MST Testnet',
  explorerUrl: ACTIVE_NETWORK.explorerUrl,
  faucetUrl: ACTIVE_NETWORK.faucetUrl,
  connecting: false,
  connect: () => {},
  disconnect: () => {},
  sendPayment: async () => {
    throw new Error('Wallet not connected');
  },
  refreshBalance: async () => {},
});

// ── WalletProvider ───────────────────────────────────────────────────────────
export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<RawEIP1193Provider | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'idle' });

  const connecting = step.kind === 'connecting' || step.kind === 'switching';

  const refreshBalance = useCallback(
    async (addr?: string) => {
      const a = addr ?? address;
      if (!a) return;
      try {
        const bal = await fetchMstcBalance(a);
        setBalance(bal);
      } catch {
        setBalance('0.0000');
      }
    },
    [address]
  );

  function showConnFailed(message: string) {
    setStep({ kind: 'conn-failed', message });
    setTimeout(() => setStep({ kind: 'idle' }), 3000);
  }

  // ── STEP 1: request accounts ───────────────────────────────────────────────
  async function doConnect(p: DetectedProvider) {
    setStep({ kind: 'connecting', p });
    let addr: string;
    try {
      addr = await connectEip1193(p.raw);
      if (!addr) {
        setStep({ kind: 'idle' });
        return;
      }
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 4001) {
        showConnFailed('Connection declined in wallet.');
      } else if (code === -32002) {
        showConnFailed('A connection request is already pending in your wallet.');
      } else {
        showConnFailed((err as Error)?.message ?? 'Connection failed.');
      }
      return;
    }

    setAddress(addr);
    setActiveProvider(p.raw);
    setStep({ kind: 'idle' });
    fetchMstcBalance(addr).then(setBalance).catch(() => setBalance('0.0000'));

    // ── STEP 2: check if on MST Testnet ───────────────────────────────────────
    try {
      const onMst = await isMstNetwork(p.raw);
      if (!onMst) {
        setStep({ kind: 'need-network', p, addr });
      }
    } catch {
      // ignore
    }
  }

  // ── STEP 2: switch to MST Testnet ──────────────────────────────────────────
  async function doSwitchNetwork(p: DetectedProvider, addr: string) {
    setStep({ kind: 'switching', p, addr, adding: false });
    try {
      await switchOrAddMstNetwork(p.raw);
      setStep({ kind: 'idle' });
      fetchMstcBalance(addr).then(setBalance).catch(() => setBalance('0.0000'));
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? 'Network switch failed.';
      setStep({ kind: 'net-failed', p, addr, message: msg });
    }
  }

  const connect = useCallback(() => {
    const list = detectProviders();
    if (list.length === 0) {
      alert('No EVM wallet extension found. Please install MetaMask, Rabby, BridgeKey, or an EIP-1193 compatible wallet.');
      return;
    }
    if (list.length === 1) {
      void doConnect(list[0]);
    } else {
      setStep({ kind: 'picking', list });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalance(null);
    setActiveProvider(null);
    setStep({ kind: 'idle' });
  }, []);

  const sendPayment = useCallback(
    async (amountMstc: string, _desc?: string): Promise<string> => {
      // If activeProvider is not set yet but window.ethereum exists, fallback to window.ethereum
      const provider = activeProvider || (typeof window !== 'undefined' ? window.ethereum : null);
      if (!address || !provider) throw new Error('Wallet not connected');

      // Execute native MSTC transfer on MST Testnet
      const txHash = await executeMstPayment(provider, address, amountMstc);
      try {
        await refreshBalance(address);
      } catch {
        /* non-critical */
      }
      return txHash;
    },
    [address, activeProvider, refreshBalance]
  );

  // ── Account change listener ────────────────────────────────────────────────
  // Only updates address if an actual valid new account is provided.
  // Does NOT disconnect on spurious empty arrays or background bridge events during navigation.
  useEffect(() => {
    if (!activeProvider) return;
    const handler = async (accounts: unknown) => {
      const list = accounts as string[];
      if (list && Array.isArray(list) && list.length > 0 && typeof list[0] === 'string' && list[0].startsWith('0x')) {
        const newAddr = list[0];
        setAddress(newAddr);
        try {
          const bal = await fetchMstcBalance(newAddr);
          setBalance(bal);
        } catch {
          setBalance('0.0000');
        }
      }
      // Note: Do not disconnect on empty list — stay connected for current session until page is refreshed.
    };
    activeProvider.on('accountsChanged', handler);
    return () => activeProvider.removeListener('accountsChanged', handler);
  }, [activeProvider]);

  const ctxValue = useMemo(
    () => ({
      address,
      balance,
      currency: 'MSTC',
      network: ACTIVE_NETWORK.chainName,
      explorerUrl: ACTIVE_NETWORK.explorerUrl,
      faucetUrl: ACTIVE_NETWORK.faucetUrl,
      connecting,
      connect,
      disconnect,
      sendPayment,
      refreshBalance,
    }),
    [address, balance, connecting, connect, disconnect, sendPayment, refreshBalance]
  );

  const modalVisible = step.kind !== 'idle';
  const backdropDismissible =
    step.kind === 'picking' ||
    step.kind === 'conn-failed' ||
    step.kind === 'need-network' ||
    step.kind === 'net-failed';

  return (
    <WalletCtx.Provider value={ctxValue}>
      {children}

      <AnimatePresence>
        {modalVisible && (
          <motion.div
            key="wallet-modal-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={() => {
              if (backdropDismissible) setStep({ kind: 'idle' });
            }}
          >
            <motion.div
              key="wallet-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              transition={{ duration: 0.14 }}
              className="bg-[#0d0d14] border border-[rgba(239,159,39,0.3)] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* STEP 1a: Picker */}
              {step.kind === 'picking' && (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[10px] font-mono text-[#ef9f27] mb-0.5">MST BLOCKCHAIN</p>
                      <h2 className="text-white font-bold text-base">Connect MST Wallet</h2>
                      <p className="text-[#8e8e9f] text-xs mt-0.5">Select your Web3 wallet extension</p>
                    </div>
                    <button
                      onClick={() => setStep({ kind: 'idle' })}
                      className="text-[#5a5a6a] hover:text-white transition-colors text-lg leading-none mt-0.5"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-2">
                    {step.list.map(p => (
                      <button
                        key={p.id}
                        onClick={() => void doConnect(p)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[rgba(239,159,39,0.15)] hover:border-[rgba(239,159,39,0.5)] hover:bg-[rgba(239,159,39,0.08)] transition-all text-left group"
                      >
                        <span className="text-2xl shrink-0">{p.icon}</span>
                        <div className="min-w-0">
                          <div className="text-white font-medium text-sm">{p.name}</div>
                          <div className="text-[#6a6a7c] text-[10px] font-mono">EIP-1193 · MST Compatible</div>
                        </div>
                        <span className="ml-auto text-[#6a6a7c] group-hover:text-[#ef9f27] transition-colors shrink-0">
                          →
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* STEP 1b: Connecting */}
              {step.kind === 'connecting' && (
                <div className="text-center py-3">
                  <div className="w-10 h-10 border-2 border-[rgba(239,159,39,0.2)] border-t-[#ef9f27] rounded-full animate-spin mx-auto mb-4" />
                  <div className="text-3xl mb-2">{step.p.icon}</div>
                  <p className="text-white font-semibold">Connecting to {step.p.name}</p>
                  <p className="text-[#8e8e9f] text-xs mt-1.5 leading-relaxed">
                    Approve the connection request in your wallet…
                  </p>
                </div>
              )}

              {/* STEP 1 failed */}
              {step.kind === 'conn-failed' && (
                <div className="text-center py-3">
                  <div className="text-3xl mb-3">✕</div>
                  <p className="text-white font-semibold">Connection Failed</p>
                  <p className="text-[#8e8e9f] text-xs mt-1.5 leading-relaxed">{step.message}</p>
                </div>
              )}

              {/* STEP 2a: Need MST Network */}
              {step.kind === 'need-network' && (
                <div className="text-center py-1">
                  <div className="text-3xl mb-3">⚡</div>
                  <p className="text-[10px] font-mono text-[#ef9f27] mb-1">NETWORK SWITCH</p>
                  <p className="text-white font-semibold">Switch to MST Testnet</p>
                  <p className="text-[#8e8e9f] text-xs mt-2 leading-relaxed">
                    AgentMesh settles real agent payments on <strong>MST Testnet</strong>.
                  </p>
                  <div className="mt-4 rounded-xl bg-[#050508] border border-[rgba(239,159,39,0.15)] px-4 py-3 text-left">
                    <div className="space-y-1.5 text-[11px] font-mono">
                      {[
                        ['Network', ACTIVE_NETWORK.chainName],
                        ['Chain ID', `${ACTIVE_NETWORK.chainIdDecimal}`],
                        ['Currency', '$MSTC'],
                        ['RPC', 'testnetrpc.mstblockchain.com'],
                        ['Explorer', 'testnet.mstscan.com'],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4">
                          <span className="text-[#6a6a7c] shrink-0">{k}</span>
                          <span className="text-white text-right break-all">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => void doSwitchNetwork(step.p, step.addr)}
                    className="mt-4 w-full py-2.5 rounded-xl bg-[rgba(239,159,39,0.12)] border border-[rgba(239,159,39,0.6)] text-[#ef9f27] text-sm font-mono hover:bg-[rgba(239,159,39,0.22)] transition-colors font-bold"
                  >
                    Add / Switch to MST Testnet →
                  </button>
                  <button
                    onClick={() => setStep({ kind: 'idle' })}
                    className="mt-2 w-full py-1.5 text-xs text-[#5a5a6a] hover:text-[#8e8e9f] transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* STEP 2b: Switching */}
              {step.kind === 'switching' && (
                <div className="text-center py-3">
                  <div className="w-10 h-10 border-2 border-[rgba(239,159,39,0.2)] border-t-[#ef9f27] rounded-full animate-spin mx-auto mb-4" />
                  <div className="text-2xl mb-2">⚡</div>
                  <p className="text-white font-semibold">Switching to MST Testnet…</p>
                  <p className="text-[#8e8e9f] text-xs mt-1.5 leading-relaxed">
                    Please approve the network configuration in {step.p.name}…
                  </p>
                </div>
              )}

              {/* STEP 2 failed */}
              {step.kind === 'net-failed' && (
                <div className="text-center py-1">
                  <div className="text-3xl mb-3">⚠️</div>
                  <p className="text-[10px] font-mono text-[#ef9f27] mb-1">NETWORK SETUP</p>
                  <p className="text-white font-semibold">MST Testnet Required</p>
                  <p className="text-[#ef4444] text-xs mt-2 leading-relaxed bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
                    {step.message}
                  </p>
                  <button
                    onClick={() => void doSwitchNetwork(step.p, step.addr)}
                    className="mt-4 w-full py-2.5 rounded-xl border border-[rgba(239,159,39,0.6)] text-[#ef9f27] text-sm font-mono hover:bg-[rgba(239,159,39,0.15)] transition-colors"
                  >
                    Try Again →
                  </button>
                  <button
                    onClick={() => setStep({ kind: 'idle' })}
                    className="mt-2 w-full py-1.5 text-xs text-[#5a5a6a] hover:text-[#8e8e9f] transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </WalletCtx.Provider>
  );
}

export function useWallet() {
  return useContext(WalletCtx);
}
