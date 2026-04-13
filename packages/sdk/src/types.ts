import type { PublicKey } from "@solana/web3.js";

export interface AgentProfile {
  authority: PublicKey;
  name: string;
  registeredAt: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksAbandoned: number;
  reputationScore: number;
  stake: number;
  isFlagged: boolean;
  bump: number;
}

export interface TaskAccount {
  taskId: number;
  requester: PublicKey;
  assignee: PublicKey;
  descriptionHash: number[];
  status: TaskStatus;
  createdAt: number;
  completedAt: number | null;
  outcome: TaskOutcome | null;
  bump: number;
}

export interface AttestationAccount {
  task: PublicKey;
  attester: PublicKey;
  agent: PublicKey;
  outcome: TaskOutcome;
  timestamp: number;
  bump: number;
}

export type TaskStatus = { open: {} } | { assigned: {} } | { completed: {} } | { disputed: {} };
export type TaskOutcome = { success: {} } | { failure: {} } | { abandoned: {} };
