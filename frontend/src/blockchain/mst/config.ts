/**
 * MST Blockchain Network Configuration
 * Official Network Parameters for MST Testnet & Mainnet
 */

export const MST_TESTNET_CONFIG = {
  chainIdHex: '0x5752035', // 91562037 (RPC reported chainId)
  altChainIdHex: '0x11c1',  // 4545
  chainIdDecimal: 91562037,
  chainName: 'MST Testnet',
  rpcUrl: process.env.NEXT_PUBLIC_MST_RPC_URL || 'https://testnetrpc.mstblockchain.com',
  explorerUrl: process.env.NEXT_PUBLIC_MST_EXPLORER_URL || 'https://testnet.mstscan.com',
  faucetUrl: 'https://faucet.masterstroke.academy',
  nativeCurrency: {
    name: 'MSTC',
    symbol: 'MSTC',
    decimals: 18,
  },
  blockExplorerUrls: ['https://testnet.mstscan.com', 'https://mstscan.com'],
};

export const MST_MAINNET_CONFIG = {
  chainIdHex: '0x1226', // 4646
  chainIdDecimal: 4646,
  chainName: 'MST Mainnet',
  rpcUrl: 'https://mariorpc.mstblockchain.com',
  explorerUrl: 'https://mstscan.com',
  nativeCurrency: {
    name: 'MSTC',
    symbol: 'MSTC',
    decimals: 18,
  },
  blockExplorerUrls: ['https://mstscan.com'],
};

// Active configuration (defaults to Testnet for hackathon and development)
export const ACTIVE_NETWORK = MST_TESTNET_CONFIG;

// Platform Escrow / Settlement Wallet Address (Legacy fallback EOA)
export const PLATFORM_ESCROW_WALLET =
  process.env.NEXT_PUBLIC_MST_PLATFORM_WALLET ||
  '0x6001712aE72d24Babc386866d035b6d55331E634';

// Settlement Mode: 'escrow' (on-chain smart contract) or 'legacy' (direct native EOA transfer)
export const MST_SETTLEMENT_MODE: 'escrow' | 'legacy' =
  ((process.env.NEXT_PUBLIC_MST_SETTLEMENT_MODE || process.env.MST_SETTLEMENT_MODE) === 'escrow' ? 'escrow' : 'legacy');

// Deployed AgentMeshEscrow Smart Contract Address on MST Testnet
export const MST_ESCROW_CONTRACT_ADDRESS: string =
  (process.env.NEXT_PUBLIC_MST_ESCROW_CONTRACT || process.env.MST_ESCROW_CONTRACT || '').trim();

export const MST_CHAIN_PARAMS = {
  chainId: ACTIVE_NETWORK.chainIdHex,
  chainName: ACTIVE_NETWORK.chainName,
  rpcUrls: [ACTIVE_NETWORK.rpcUrl],
  nativeCurrency: ACTIVE_NETWORK.nativeCurrency,
  blockExplorerUrls: ACTIVE_NETWORK.blockExplorerUrls,
};
