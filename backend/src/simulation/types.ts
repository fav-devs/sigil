import type { Keypair, PublicKey } from "@solana/web3.js";

export interface AgentConfig {
  id: string;
  name: string;
  profileType: string;
  acceptanceRate: number;
  completionRate: number;
  abandonRate: number;
  reputationThreshold: number;
  useLlmForDecisions: boolean;
  reputationScore: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksAbandoned: number;
  status: "idle" | "working" | "flagged";
  isFlagged: boolean;
  keypair?: Keypair;
  publicKey?: string;
  currentTaskId?: string;
}

export interface TaskState {
  id: string;
  description: string;
  descriptionHash: number[];
  requester: string;
  assignee: string | null;
  status: "open" | "assigned" | "completed";
  outcome: "success" | "failure" | "abandoned" | null;
  createdAt: number;
  assignedAtTick: number | null;
  completedAt: number | null;
  taskPda?: PublicKey;
  txSignature?: string;
}

export interface SimulationEvent {
  type: string;
  agentId?: string;
  taskId?: string;
  partnerId?: string;
  message: string;
  reasoning?: string;
  txSignature?: string;
  timestamp: number;
}

export interface SimulationState {
  isRunning: boolean;
  tickCount: number;
  agents: SerializedAgent[];
  tasks: SerializedTask[];
  events: SimulationEvent[];
}

export type SerializedAgent = Omit<AgentConfig, "keypair">;

export interface SerializedTask {
  id: string;
  description: string;
  requester: string;
  assignee: string | null;
  status: "open" | "assigned" | "completed";
  outcome: "success" | "failure" | "abandoned" | null;
  createdAt: number;
  completedAt: number | null;
  txSignature?: string;
  taskPda?: string;
}
