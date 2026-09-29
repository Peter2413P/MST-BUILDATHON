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

export type UIAuthState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'WALLET_CONNECTED'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'PAYMENT_AUTHORIZATION_REQUIRED'
  | 'READY';

// Modal steps
type Step =
  | { kind: 'idle' }
  | { kind: 'picking'; list: DetectedProvider[] }
  | { kind: 'connecting'; p: DetectedProvider }
  | { kind: 'conn-failed'; message: string }
  | { kind: 'need-network'; p: DetectedProvider; addr: string }
  | { kind: 'switching'; p: DetectedProvider; addr: string; adding: boolean }
  | { kind: 'net-failed'; p: DetectedProvider; addr: string; message: string }
  | { kind: 'sign-auth'; p: DetectedProvider; addr: string; nonce: string; message: string }
  | { kind: 'auth-failed'; message: string }
  | { kind: 'authorize-payment'; sessionId: string; addr: string };

export interface SessionBudget {
  autoPaymentEnabled: boolean;
  sessionLimit: number;
  sessionSpent: number;
  remaining: number;
}

export interface WalletState {
  address: string | null;
  balance: string | null;
  currency: string;
  network: string;
  explorerUrl: string;
  faucetUrl: string;
  connecting: boolean;
  authState: UIAuthState;
  sessionId: string | null;
  authenticated: boolean;
  autoPaymentEnabled: boolean;
  sessionBudget: SessionBudget;
  connect: () => void;
  authenticate: () => Promise<boolean>;
  authorizeAutoPayments: (maxSpendMstc?: number) => Promise<boolean>;
  disconnect: () => void;
  sendPayment: (amountMstc: string, description?: string) => Promise<string>;
  refreshBalance: () => Promise<void>;
  refreshSessionStatus: () => Promise<void>;
}

const WalletCtx = createContext<WalletState>({
  address: null,
  balance: null,
  currency: 'MSTC',
  network: 'MST Testnet',
  explorerUrl: ACTIVE_NETWORK.explorerUrl,
  faucetUrl: ACTIVE_NETWORK.faucetUrl,
  connecting: false,
  authState: 'DISCONNECTED',
  sessionId: null,
  authenticated: false,
  autoPaymentEnabled: false,
  sessionBudget: { autoPaymentEnabled: false, sessionLimit: 0, sessionSpent: 0, remaining: 0 },
  connect: () => {},
  authenticate: async () => false,
  authorizeAutoPayments: async () => false,
  disconnect: () => {},
  sendPayment: async () => {
    throw new Error('Wallet not connected');
  },
  refreshBalance: async () => {},
  refreshSessionStatus: async () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  // In-memory authentication state (Reset on page refresh)
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<RawEIP1193Provider | null>(null);
  const [activeDetectedProvider, setActiveDetectedProvider] = useState<DetectedProvider | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'idle' });

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [authState, setAuthState] = useState<UIAuthState>('DISCONNECTED');
  const [sessionBudget, setSessionBudget] = useState<SessionBudget>({
    autoPaymentEnabled: false,
    sessionLimit: 0,
    sessionSpent: 0,
    remaining: 0,
  });

  const connecting = step.kind === 'connecting' || step.kind === 'switching' || authState === 'CONNECTING' || authState === 'AUTHENTICATING';

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

  const refreshSessionStatus = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/payment/session-status?sessionId=${sessionId}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setSessionBudget({
            autoPaymentEnabled: Boolean(data.autoPaymentEnabled),
            sessionLimit: data.sessionLimit || 0,
            sessionSpent: data.sessionSpent || 0,
            remaining: data.remaining || 0,
          });
          if (data.autoPaymentEnabled) {
            setAuthState('READY');
          }
        }
      }
    } catch {
      // Non-blocking
    }
  }, [sessionId]);

  function showConnFailed(message: string) {
    setStep({ kind: 'conn-failed', message });
    setAuthState('DISCONNECTED');
    setTimeout(() => setStep({ kind: 'idle' }), 3500);
  }

  function showAuthFailed(message: string) {
    setStep({ kind: 'auth-failed', message });
    setAuthState('WALLET_CONNECTED');
    setTimeout(() => setStep({ kind: 'idle' }), 3500);
  }

  // ── Step 1: Connect Wallet ───────────────────────────────────────────────────
  async function doConnect(p: DetectedProvider) {
    setStep({ kind: 'connecting', p });
    setAuthState('CONNECTING');
    let addr: string;

    try {
      addr = await connectEip1193(p.raw);
      if (!addr) {
        setStep({ kind: 'idle' });
        setAuthState('DISCONNECTED');
        return;
      }
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 4001) {
        showConnFailed('Connection request declined in wallet.');
      } else if (code === -32002) {
        showConnFailed('A connection request is already pending in your wallet.');
      } else {
        showConnFailed((err as Error)?.message ?? 'Connection failed.');
      }
      return;
    }

    setAddress(addr);
    setActiveProvider(p.raw);
    setActiveDetectedProvider(p);
    fetchMstcBalance(addr).then(setBalance).catch(() => setBalance('0.0000'));

    // Step 2: Validate MST Testnet
    try {
      const onMst = await isMstNetwork(p.raw);
      if (!onMst) {
        setStep({ kind: 'need-network', p, addr });
        return;
      }
    } catch {
      // ignore
    }

    setAuthState('WALLET_CONNECTED');
    // Prompt Step 3: Authenticate
    void startAuthFlow(p, addr);
  }

  // ── Step 2: Switch Network ───────────────────────────────────────────────────
  async function doSwitchNetwork(p: DetectedProvider, addr: string) {
    setStep({ kind: 'switching', p, addr, adding: false });
    try {
      await switchOrAddMstNetwork(p.raw);
      fetchMstcBalance(addr).then(setBalance).catch(() => setBalance('0.0000'));
      setAuthState('WALLET_CONNECTED');
      // Proceed to authentication after network switch
      void startAuthFlow(p, addr);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? 'Network switch failed.';
      setStep({ kind: 'net-failed', p, addr, message: msg });
    }
  }

  // ── Step 3: Nonce & Signature Authentication ─────────────────────────────────
  async function startAuthFlow(p: DetectedProvider, addr: string) {
    try {
      setAuthState('AUTHENTICATING');
      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: addr }),
      });

      if (!nonceRes.ok) throw new Error('Failed to retrieve authentication nonce');
      const { nonce, message } = await nonceRes.json();

      setStep({ kind: 'sign-auth', p, addr, nonce, message });
    } catch (err) {
      showAuthFailed((err as Error).message || 'Failed to start authentication');
    }
  }

  async function executeSignature(p: DetectedProvider, addr: string, message: string) {
    try {
      const signature = await p.raw.request<string>({
        method: 'personal_sign',
        params: [message, addr],
      });

      if (!signature) {
        throw new Error('Signature cancelled');
      }

      // Verify signature on backend
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: addr, signature }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json();
        throw new Error(errData.error || 'Authentication verification failed');
      }

      const sessionData = await verifyRes.json();
      setSessionId(sessionData.sessionId);
      setAuthState('PAYMENT_AUTHORIZATION_REQUIRED');

      // Prompt Step 4: Authorize automatic task payment
      setStep({ kind: 'authorize-payment', sessionId: sessionData.sessionId, addr });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 4001) {
        showAuthFailed('Signature was declined. Authentication cancelled.');
      } else {
        showAuthFailed((err as Error).message || 'Signature verification failed.');
      }
    }
  }

  // ── Step 4: Authorize Session Auto-Payments ──────────────────────────────────
  const authorizeAutoPayments = useCallback(
    async (maxSpendMstc: number = 1.0): Promise<boolean> => {
      if (!sessionId) return false;
      try {
        const res = await fetch('/api/payment/session-authorize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionId}`,
          },
          body: JSON.stringify({ sessionId, maxSpendMstc }),
        });

        if (!res.ok) throw new Error('Failed to authorize session payments');
        const data = await res.json();

        setSessionBudget({
          autoPaymentEnabled: true,
          sessionLimit: data.sessionLimit,
          sessionSpent: data.sessionSpent,
          remaining: data.remaining,
        });

        setAuthState('READY');
        setStep({ kind: 'idle' });
        return true;
      } catch (err) {
        console.error('[Payment Authorization] Failed:', err);
        return false;
      }
    },
    [sessionId]
  );

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (activeDetectedProvider && address) {
      await startAuthFlow(activeDetectedProvider, address);
      return true;
    }
    return false;
  }, [activeDetectedProvider, address]);

  const connect = useCallback(() => {
    const list = detectProviders();
    if (list.length === 0) {
      alert('No EVM wallet extension found. Please install MetaMask, Rabby, or an EIP-1193 compatible wallet.');
      return;
    }
    if (list.length === 1) {
      void doConnect(list[0]);
    } else {
      setStep({ kind: 'picking', list });
    }
  }, []);

  const disconnect = useCallback(() => {
    if (sessionId) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, walletAddress: address }),
      }).catch(() => {});
    }

    setAddress(null);
    setBalance(null);
    setActiveProvider(null);
    setActiveDetectedProvider(null);
    setSessionId(null);
    setAuthState('DISCONNECTED');
    setSessionBudget({ autoPaymentEnabled: false, sessionLimit: 0, sessionSpent: 0, remaining: 0 });
    setStep({ kind: 'idle' });
  }, [sessionId, address]);

  const sendPayment = useCallback(
    async (amountMstc: string, desc?: string): Promise<string> => {
      const provider =
        activeProvider ||
        (typeof window !== 'undefined' ? (window as unknown as { ethereum?: RawEIP1193Provider }).ethereum : null);
      if (!address || !provider) throw new Error('Wallet not connected');

      const txHash = await executeMstPayment(provider, address, amountMstc, undefined, desc);
      try {
        await refreshBalance(address);
        await refreshSessionStatus();
      } catch {
        /* non-critical */
      }
      return txHash;
    },
    [address, activeProvider, refreshBalance, refreshSessionStatus]
  );

  // ── Account Change Listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!activeProvider) return;

    const handler = async (accounts: unknown) => {
      const list = accounts as string[];
      if (list && Array.isArray(list) && list.length > 0 && typeof list[0] === 'string' && list[0].startsWith('0x')) {
        const newAddr = list[0];
        if (address && newAddr.toLowerCase() !== address.toLowerCase()) {
          console.log(`[Auth] Account changed from ${address} to ${newAddr}. Invalidating session.`);
          // Invalidate old session
          if (sessionId) {
            fetch('/api/auth/logout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId, walletAddress: address }),
            }).catch(() => {});
          }

          setSessionId(null);
          setAddress(newAddr);
          setAuthState('WALLET_CONNECTED');
          setSessionBudget({ autoPaymentEnabled: false, sessionLimit: 0, sessionSpent: 0, remaining: 0 });

          // Start fresh authentication for Wallet B
          if (activeDetectedProvider) {
            void startAuthFlow(activeDetectedProvider, newAddr);
          }
        }
      } else {
        // Disconnected in wallet
        disconnect();
      }
    };

    activeProvider.on('accountsChanged', handler);
    return () => activeProvider.removeListener('accountsChanged', handler);
  }, [activeProvider, address, sessionId, activeDetectedProvider, disconnect]);

  const ctxValue = useMemo(
    () => ({
      address,
      balance,
      currency: 'MSTC',
      network: ACTIVE_NETWORK.chainName,
      explorerUrl: ACTIVE_NETWORK.explorerUrl,
      faucetUrl: ACTIVE_NETWORK.faucetUrl,
      connecting,
      authState,
      sessionId,
      authenticated: authState === 'AUTHENTICATED' || authState === 'PAYMENT_AUTHORIZATION_REQUIRED' || authState === 'READY',
      autoPaymentEnabled: sessionBudget.autoPaymentEnabled,
      sessionBudget,
      connect,
      authenticate,
      authorizeAutoPayments,
      disconnect,
      sendPayment,
      refreshBalance,
      refreshSessionStatus,
    }),
    [
      address,
      balance,
      connecting,
      authState,
      sessionId,
      sessionBudget,
      connect,
      authenticate,
      authorizeAutoPayments,
      disconnect,
      sendPayment,
      refreshBalance,
      refreshSessionStatus,
    ]
  );

  const modalVisible = step.kind !== 'idle';
  const backdropDismissible =
    step.kind === 'picking' ||
    step.kind === 'conn-failed' ||
    step.kind === 'need-network' ||
    step.kind === 'net-failed' ||
    step.kind === 'auth-failed';

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
              className="bg-[#0e110d] dark:bg-[#121411] border border-[#3d6a00]/40 dark:border-[#B8FF00]/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-[#121511] dark:text-[#F5F7F2]"
              onClick={e => e.stopPropagation()}
            >
              {/* STEP 1: Provider Picker */}
              {step.kind === 'picking' && (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[10px] font-mono text-[#a8f000] dark:text-[#B8FF00] mb-0.5">MST BLOCKCHAIN</p>
                      <h2 className="text-white font-bold text-base">Connect MST Wallet</h2>
                      <p className="text-[#8e9489] text-xs mt-0.5">Select your Web3 wallet extension</p>
                    </div>
                    <button
                      onClick={() => setStep({ kind: 'idle' })}
                      className="text-[#687062] hover:text-white transition-colors text-lg leading-none mt-0.5"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-2">
                    {step.list.map(p => (
                      <button
                        key={p.id}
                        onClick={() => void doConnect(p)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#292E27] hover:border-[#B8FF00]/50 hover:bg-[#B8FF00]/10 transition-all text-left group cursor-pointer"
                      >
                        <span className="text-2xl shrink-0">{p.icon}</span>
                        <div className="min-w-0">
                          <div className="text-white font-medium text-sm">{p.name}</div>
                          <div className="text-[#8e9489] text-[10px] font-mono">EIP-1193 · MST Compatible</div>
                        </div>
                        <span className="ml-auto text-[#8e9489] group-hover:text-[#B8FF00] transition-colors shrink-0">
                          →
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Connecting indicator */}
              {step.kind === 'connecting' && (
                <div className="text-center py-3">
                  <div className="w-10 h-10 border-2 border-[#B8FF00]/20 border-t-[#B8FF00] rounded-full animate-spin mx-auto mb-4" />
                  <div className="text-3xl mb-2">{step.p.icon}</div>
                  <p className="text-white font-semibold">Connecting to {step.p.name}</p>
                  <p className="text-[#8e9489] text-xs mt-1.5 leading-relaxed">
                    Approve the connection request in your wallet extension…
                  </p>
                </div>
              )}

              {/* Connection failed */}
              {step.kind === 'conn-failed' && (
                <div className="text-center py-3">
                  <div className="text-3xl mb-3">✕</div>
                  <p className="text-white font-semibold">Connection Failed</p>
                  <p className="text-[#8e9489] text-xs mt-1.5 leading-relaxed">{step.message}</p>
                </div>
              )}

              {/* Network switch requirement */}
              {step.kind === 'need-network' && (
                <div className="text-center py-1">
                  <div className="text-3xl mb-3">⚡</div>
                  <p className="text-[10px] font-mono text-[#B8FF00] mb-1">NETWORK SETUP</p>
                  <p className="text-white font-semibold text-base">Please switch to MST Testnet</p>
                  <p className="text-[#8e9489] text-xs mt-2 leading-relaxed">
                    AgentMesh operates on <strong>MST Testnet (Chain ID 91562037)</strong>.
                  </p>
                  <button
                    onClick={() => void doSwitchNetwork(step.p, step.addr)}
                    className="mt-5 w-full py-2.5 rounded-xl bg-[#B8FF00] text-black font-bold text-sm font-mono hover:bg-[#a8f000] transition-colors cursor-pointer"
                  >
                    Switch to MST Testnet →
                  </button>
                  <button
                    onClick={() => setStep({ kind: 'idle' })}
                    className="mt-2 w-full py-1.5 text-xs text-[#8e9489] hover:text-white transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* STEP 3: Sign Authentication */}
              {step.kind === 'sign-auth' && (
                <div className="py-2 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#B8FF00]/15 border border-[#B8FF00]/30 flex items-center justify-center mx-auto mb-3 text-[#B8FF00]">
                    <span className="material-symbols-outlined text-[24px]">key</span>
                  </div>
                  <p className="text-[10px] font-mono text-[#B8FF00] uppercase tracking-wider mb-1">Step 2 of 3 · Authentication</p>
                  <h3 className="text-white font-bold text-base">Authenticate Session</h3>
                  <p className="text-xs text-[#8e9489] mt-2 leading-relaxed font-sans">
                    Sign this message to authenticate. No MSTC will be transferred.
                  </p>

                  <div className="mt-3 p-3 rounded-xl bg-[#090b08] border border-[#292E27] text-left">
                    <p className="text-[10px] font-mono text-[#8e9489] mb-1">Account:</p>
                    <p className="text-[11px] font-mono text-white truncate">{step.addr}</p>
                    <p className="text-[10px] font-mono text-[#8e9489] mt-2 mb-1">Signature Payload:</p>
                    <p className="text-[10px] font-mono text-[#8e9489] line-clamp-2">{step.message}</p>
                  </div>

                  <button
                    onClick={() => void executeSignature(step.p, step.addr, step.message)}
                    className="mt-4 w-full py-2.5 rounded-xl bg-[#B8FF00] text-black font-bold text-xs font-mono hover:bg-[#a8f000] transition-all shadow-sm cursor-pointer"
                  >
                    Sign in Wallet (0 MSTC) →
                  </button>
                </div>
              )}

              {/* STEP 4: Session Payment Authorization */}
              {step.kind === 'authorize-payment' && (
                <div className="py-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#B8FF00]/15 border border-[#B8FF00]/30 flex items-center justify-center mx-auto mb-3 text-[#B8FF00]">
                    <span className="material-symbols-outlined text-[24px]">flash_on</span>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-mono text-[#B8FF00] uppercase tracking-wider mb-1">Step 3 of 3 · Task Authorization</p>
                    <h3 className="text-white font-bold text-base">Enable Automatic Task Payments</h3>
                    <p className="text-xs text-[#8e9489] mt-1.5 leading-relaxed">
                      AgentMesh can automatically settle eligible agent tasks during this session.
                    </p>
                  </div>

                  <div className="mt-4 p-3.5 rounded-xl bg-[#090b08] border border-[#292E27] space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#8e9489] font-mono">Session Limit:</span>
                      <span className="text-white font-mono font-bold">1.0000 MSTC</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#8e9489] font-mono">Upfront Charge:</span>
                      <span className="text-[#B8FF00] font-mono font-bold">0.0000 MSTC</span>
                    </div>
                    <p className="text-[10px] text-[#687062] pt-1 border-t border-[#1d221c] leading-relaxed">
                      No payment is made during authorization. Micro-payments only trigger after successful task validation.
                    </p>
                  </div>

                  <button
                    onClick={() => void authorizeAutoPayments(1.0)}
                    className="mt-4 w-full py-2.5 rounded-xl bg-[#B8FF00] text-black font-bold text-xs font-mono hover:bg-[#a8f000] transition-all shadow-sm cursor-pointer"
                  >
                    Enable for this Session →
                  </button>
                  <button
                    onClick={() => setStep({ kind: 'idle' })}
                    className="mt-2 w-full py-1 text-xs text-[#687062] hover:text-[#8e9489] transition-colors cursor-pointer text-center block"
                  >
                    Decide later
                  </button>
                </div>
              )}

              {/* Authentication failure */}
              {step.kind === 'auth-failed' && (
                <div className="text-center py-3">
                  <div className="text-3xl mb-3">⚠️</div>
                  <p className="text-white font-semibold">Authentication Notice</p>
                  <p className="text-[#8e9489] text-xs mt-1.5 leading-relaxed">{step.message}</p>
                  <button
                    onClick={() => {
                      if (activeDetectedProvider && address) {
                        void startAuthFlow(activeDetectedProvider, address);
                      } else {
                        setStep({ kind: 'idle' });
                      }
                    }}
                    className="mt-4 w-full py-2.5 rounded-xl bg-[#B8FF00] text-black font-bold text-xs font-mono hover:bg-[#a8f000] transition-all shadow-sm cursor-pointer"
                  >
                    Request Fresh Nonce & Sign →
                  </button>
                  <button
                    onClick={() => setStep({ kind: 'idle' })}
                    className="mt-2 w-full py-1 text-xs text-[#687062] hover:text-[#8e9489] transition-colors cursor-pointer text-center block"
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
