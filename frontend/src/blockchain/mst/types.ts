/**
 * MST Blockchain Types & Payment State Machine
 */

export type PaymentState =
  | 'CREATED'            // Job formulated, awaiting payment
  | 'PAYMENT_PENDING'    // Transaction submitted to MST Testnet
  | 'PAYMENT_CONFIRMED'  // Transaction mined & confirmed on MST Blockchain
  | 'EXECUTING'          // AI Agents running subtasks
  | 'COMPLETED'          // Agent output returned & settled
  | 'PAYMENT_FAILED'     // Transaction rejected or failed on-chain
  | 'EXECUTION_FAILED'   // AI Agent execution error
  | 'REFUND_PENDING'     // Refund queued to return MSTC to user
  | 'REFUNDED';          // Refund completed on-chain

export interface MSTTransaction {
  hash: string;
  from: string;
  to: string;
  valueMstc: string;
  blockNumber?: number;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  explorerUrl: string;
}

export interface MSTPaymentRecord {
  jobId: string;
  payerAddress: string;
  recipientAddress: string;
  amountMstc: string;
  txHash: string;
  paymentState: PaymentState;
  createdAt: string;
  confirmedAt?: string;
  subtaskSplits?: {
    agentId: string;
    agentName: string;
    amountMstc: string;
    agentWallet: string;
    txHash?: string;
  }[];
}

export interface RawEIP1193Provider {
  isBridgeKey?: boolean;
  isBridge?: boolean;
  isMST?: boolean;
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isFrame?: boolean;
  isTrust?: boolean;
  request: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
  providers?: RawEIP1193Provider[];
}

export interface DetectedProvider {
  id: string;
  name: string;
  icon: string;
  raw: RawEIP1193Provider;
}
