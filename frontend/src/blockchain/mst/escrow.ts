import { ethers } from 'ethers';
import {
  ACTIVE_NETWORK,
  MST_ESCROW_CONTRACT_ADDRESS,
  MST_SETTLEMENT_MODE,
  PLATFORM_ESCROW_WALLET,
} from './config';

export { MST_ESCROW_CONTRACT_ADDRESS };
import type { RawEIP1193Provider } from './types';
import escrowArtifact from './escrow-abi.json';

export const ESCROW_ABI = escrowArtifact.abi;
export const ESCROW_BYTECODE = escrowArtifact.bytecode;

export type EscrowStatus = 'None' | 'Funded' | 'Completed' | 'Failed' | 'Refunded' | 'Cancelled';

export const ESCROW_STATUS_MAP: Record<number, EscrowStatus> = {
  0: 'None',
  1: 'Funded',
  2: 'Completed',
  3: 'Failed',
  4: 'Refunded',
  5: 'Cancelled',
};

export interface EscrowTaskView {
  taskId: string;
  payer: string;
  agent: string;
  amountMstc: string;
  amountWei: string;
  createdAt: number;
  deadline: number;
  status: EscrowStatus;
  statusCode: number;
}

/**
 * Deterministically maps any AgentGuild UUID/string jobId into an on-chain bytes32 taskId.
 */
export function calculateTaskId(jobId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(jobId.trim()));
}

/**
 * Checks whether escrow mode is enabled and a valid contract address is configured.
 */
export function isEscrowEnabled(): boolean {
  return (
    MST_SETTLEMENT_MODE === 'escrow' &&
    Boolean(MST_ESCROW_CONTRACT_ADDRESS && ethers.isAddress(MST_ESCROW_CONTRACT_ADDRESS))
  );
}

/**
 * Returns the active contract address or throws if unconfigured.
 */
export function getEscrowContractAddress(): string {
  const addr = MST_ESCROW_CONTRACT_ADDRESS;
  if (!addr || !ethers.isAddress(addr)) {
    throw new Error('AgentMeshEscrow contract address is not configured on this network.');
  }
  return ethers.getAddress(addr);
}

/**
 * Creates and funds a task on the AgentMeshEscrow contract via the user's browser wallet (EIP-1193).
 *
 * @param provider EIP-1193 browser wallet provider
 * @param fromAddress The payer wallet address
 * @param jobId The AgentGuild job identifier
 * @param agentAddress The hired agent's wallet address
 * @param amountMstc Amount of native MSTC to lock in escrow
 * @param deadlineSeconds Seconds until deadline (default: 3600 = 1 hour)
 */
export async function createTaskOnEscrow(
  provider: RawEIP1193Provider,
  fromAddress: string,
  jobId: string,
  agentAddress: string = PLATFORM_ESCROW_WALLET,
  amountMstc: string,
  deadlineSeconds: number = 3600
): Promise<{ txHash: string; taskId: string; contractAddress: string; deadline: number }> {
  if (!fromAddress) throw new Error('Wallet not connected');

  const contractAddress = getEscrowContractAddress();
  const cleanFrom = ethers.getAddress(fromAddress.toLowerCase());
  const cleanAgent = ethers.getAddress(agentAddress.toLowerCase());

  const taskId = calculateTaskId(jobId);
  const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds;
  const valueWei = ethers.parseEther(amountMstc);
  const valueHex = '0x' + valueWei.toString(16);

  // Encode function call: createTask(bytes32 taskId, address agent, uint256 deadline)
  const iface = new ethers.Interface(ESCROW_ABI);
  const calldata = iface.encodeFunctionData('createTask', [taskId, cleanAgent, deadline]);

  console.log(`[Escrow Client] Submitting createTask for job ${jobId} (taskId: ${taskId})`);
  console.log(`[Escrow Client] Amount: ${amountMstc} MSTC -> Escrow ${contractAddress}`);

  const txHash = await provider.request<string>({
    method: 'eth_sendTransaction',
    params: [
      {
        from: cleanFrom,
        to: contractAddress,
        value: valueHex,
        data: calldata,
      },
    ],
  });

  if (!txHash) {
    throw new Error('No transaction hash returned from escrow transaction');
  }

  console.log(`[Escrow Client] createTask broadcasted: ${txHash}`);
  return { txHash, taskId, contractAddress, deadline };
}

/**
 * Reads the authoritative on-chain task state from AgentMeshEscrow contract.
 */
export async function fetchEscrowTask(
  taskId: string,
  customProvider?: ethers.Provider
): Promise<EscrowTaskView | null> {
  try {
    const contractAddress = getEscrowContractAddress();
    const provider =
      customProvider ||
      new ethers.JsonRpcProvider(ACTIVE_NETWORK.rpcUrl, {
        chainId: ACTIVE_NETWORK.chainIdDecimal,
        name: 'mst-testnet',
      });

    const contract = new ethers.Contract(contractAddress, ESCROW_ABI, provider);
    const task = await contract.getTask(taskId);

    const statusCode = Number(task.status);
    const status = ESCROW_STATUS_MAP[statusCode] || 'None';

    return {
      taskId: task.taskId,
      payer: task.payer,
      agent: task.agent,
      amountMstc: ethers.formatEther(task.amount),
      amountWei: task.amount.toString(),
      createdAt: Number(task.createdAt),
      deadline: Number(task.deadline),
      status,
      statusCode,
    };
  } catch (err) {
    console.warn(`[Escrow Client] Could not fetch task ${taskId}:`, (err as Error).message);
    return null;
  }
}
