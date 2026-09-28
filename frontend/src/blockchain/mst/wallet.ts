import { ACTIVE_NETWORK, MST_CHAIN_PARAMS } from './config';
import type { RawEIP1193Provider, DetectedProvider } from './types';
import { getBalance } from './client';

declare global {
  interface Window {
    ethereum?: RawEIP1193Provider;
  }
}

/**
 * Identify metadata for injected browser wallets including BridgeKey.
 */
function getProviderMetadata(p: RawEIP1193Provider): { id: string; name: string; icon: string } {
  if (p.isBridgeKey || p.isBridge) return { id: 'bridgekey', name: 'BridgeKey Wallet', icon: '🔑' };
  if (p.isRabby) return { id: 'rabby', name: 'Rabby Wallet', icon: '🐰' };
  if (p.isCoinbaseWallet) return { id: 'coinbase', name: 'Coinbase Wallet', icon: '🔵' };
  if (p.isBraveWallet) return { id: 'brave', name: 'Brave Wallet', icon: '🦁' };
  if (p.isFrame) return { id: 'frame', name: 'Frame', icon: '🖼️' };
  if (p.isTrust) return { id: 'trust', name: 'Trust Wallet', icon: '🔷' };
  if (p.isMetaMask) return { id: 'metamask', name: 'MetaMask', icon: '🦊' };
  return { id: 'injected', name: 'BridgeKey / Web3 Wallet', icon: '⚡' };
}

/**
 * Detect all available EIP-1193 browser wallets.
 */
export function detectProviders(): DetectedProvider[] {
  if (typeof window === 'undefined' || !window.ethereum) return [];
  const eth = window.ethereum;
  const rawProviders = eth.providers?.length ? eth.providers : [eth];
  const seen = new Set<string>();
  const list: DetectedProvider[] = [];

  for (const p of rawProviders) {
    const meta = getProviderMetadata(p);
    if (!seen.has(meta.id)) {
      seen.add(meta.id);
      list.push({ ...meta, raw: p });
    }
  }
  return list;
}

/**
 * Connect to an injected wallet and return active address.
 */
export async function connectWallet(provider: RawEIP1193Provider): Promise<string> {
  const accounts = await provider.request<string[]>({ method: 'eth_requestAccounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts selected in wallet');
  }
  return accounts[0];
}

/**
 * Check if the wallet is currently connected to MST Testnet.
 */
export async function isMstNetwork(provider: RawEIP1193Provider): Promise<boolean> {
  try {
    const chainId = await provider.request<string>({ method: 'eth_chainId' });
    const currentHex = chainId?.toLowerCase();
    return (
      currentHex === ACTIVE_NETWORK.chainIdHex.toLowerCase() ||
      currentHex === ACTIVE_NETWORK.altChainIdHex.toLowerCase() ||
      parseInt(currentHex || '0', 16) === ACTIVE_NETWORK.chainIdDecimal
    );
  } catch {
    return false;
  }
}

/**
 * Switch wallet to MST Testnet, or prompt user to add it if not present.
 */
export async function switchOrAddMstNetwork(provider: RawEIP1193Provider): Promise<void> {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ACTIVE_NETWORK.chainIdHex }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number | string })?.code;
    const numCode = typeof code === 'string' ? parseInt(code, 10) : code;

    // 4902 indicates chain has not been added to wallet yet
    if (numCode === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [MST_CHAIN_PARAMS],
      });
    } else {
      throw err;
    }
  }
}

export { getBalance };
