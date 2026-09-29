import type { PaymentState } from '@/blockchain/mst';

export interface Agent {
  id: string;
  name: string;
  skill: string;
  description: string;
  price_mstc?: number;
  price_usdc: number; // Backwards-compatible alias for price in base units (MSTC)
  price_unit: string;
  currency?: string;
  wallet_id: string;
  wallet_address: string;
  bond_amount: number;
  bond_slashed: number;
  status: string;
  base_url: string;
  total_jobs: number;
  total_earned: number;
  avg_quality: number;
  bond_available?: number;
  registered_at: string;
  last_active: string | null;
}

export type SubtaskStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'settled'
  | 'failed'
  | 'blocked'
  | 'cancelled'
  | 'retrying';

export type ValidationStatus = 'pending' | 'valid' | 'invalid';

export interface Subtask {
  id: string;
  job_id: string;
  agent_id: string;
  agent_name: string;
  skill: string;
  prompt: string;
  description?: string;
  result: string | null;
  tokens_used: number;
  complexity_weight: number;
  quality_score: number;
  contribution_pct: number | null;
  payment_mstc?: number | null;
  payment_usdc: number | null; // Backwards-compatible alias for MSTC payout
  payout_amount?: number | null;
  payment_tx: string | null;
  status: SubtaskStatus;
  validation_status?: ValidationStatus;
  dependencies?: string[];
  blocked_by?: string | null;
  error?: string | null;
  error_type?: string | null;
  optional?: boolean;
  retry_count?: number;
  position: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface EscrowMetadata {
  enabled: boolean;
  contractAddress?: string;
  taskId?: string;
  fundingTxHash?: string | null;
  settlementTxHash?: string | null;
  refundTxHash?: string | null;
  status?: 'none' | 'funded' | 'completed' | 'failed' | 'refunded' | 'cancelled';
}

export interface Job {
  id: string;
  description: string;
  status: 'pending' | 'planning' | 'running' | 'settling' | 'completed' | 'failed' | 'settled' | 'cancelled';
  payment_state?: PaymentState;
  total_price_mstc?: number | null;
  total_price_usdc: number | null; // Backwards-compatible alias for MSTC total
  currency?: string;
  result: string | null;
  error: string | null;
  submitted_at: string;
  created_at?: string;
  completed_at: string | null;
  job_type?: 'auto' | 'direct';
  direct_agent_id?: string | null;
  buyer_tx?: string | null;
  transaction_hash?: string | null;
  subtasks?: Subtask[];
  escrow?: EscrowMetadata;
  escrow_task_id?: string | null;
  escrow_contract?: string | null;
  settlement_tx?: string | null;
  refund_tx?: string | null;
}

export interface Transaction {
  id: string;
  job_id: string;
  agent_id: string;
  amount_mstc?: number;
  amount_usdc: number; // Backwards-compatible alias for MSTC amount
  currency?: string;
  tx_hash: string;
  demo?: number;
  created_at: string;
  agent_name?: string;
  agent_skill?: string;
  job_description?: string;
  type?: string;
  from_address?: string;
  to_address?: string;
}

export interface DailyStat {
  date: string;
  jobs: number;
  usdc: number; // MSTC amount
  mstc?: number;
}

export interface SkillStat {
  skill: string;
  count: number;
  total_usdc: number;
  total_mstc?: number;
}

export interface Metrics {
  totals: {
    jobs_completed: number;
    total_jobs: number;
    usdc_settled: number;
    mstc_settled?: number;
    avg_settlement_secs: number;
    avg_agents_per_job: number;
    agents_registered: number;
    agents_earning: number;
    bond_slashes: number;
  };
  top_agents: Agent[];
  recent_jobs: Job[];
  daily_stats: DailyStat[];
  skills_distribution: SkillStat[];
  leaderboard: Agent[];
}
