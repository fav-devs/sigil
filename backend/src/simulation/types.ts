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
}

export interface TaskState {
  id: string;
  description: string;
  descriptionHash: string;
  requester: string;
  assignee: string | null;
  status: "open" | "assigned" | "completed";
  outcome: "success" | "failure" | "abandoned" | null;
  createdAt: number;
  completedAt: number | null;
}

export interface SimulationEvent {
  type: string;
  agentId?: string;
  taskId?: string;
  partnerId?: string;
  message: string;
  reasoning?: string;
  timestamp: number;
}

export interface SimulationState {
  isRunning: boolean;
  tickCount: number;
  agents: AgentConfig[];
  events: SimulationEvent[];
}
