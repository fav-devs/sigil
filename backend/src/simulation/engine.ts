import type { Server } from "socket.io";
import { Keypair } from "@solana/web3.js";
import type { SolanaService } from "../services/solana.js";
import type { LLMService } from "../services/llm.js";
import type {
  AgentConfig,
  TaskState,
  SimulationEvent,
  SimulationState,
  SerializedAgent,
  SerializedTask,
} from "./types.js";
import { AGENT_PRESETS } from "./agents.js";
import { pickTaskDescription } from "./tasks.js";
import {
  acceptReasoning,
  rejectReasoning,
  outcomeReasoning,
} from "./reasoning.js";

const MAX_OPEN_TASKS = 10;
const TICKS_BEFORE_COMPLETION = 2;
const FLAG_THRESHOLD = 2000;

export class SimulationEngine {
  private io: Server;
  private solana: SolanaService;
  private llm: LLMService;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private agents: Map<string, AgentConfig> = new Map();
  private tasks: Map<string, TaskState> = new Map();
  private events: SimulationEvent[] = [];
  private tickCount = 0;
  private taskCounter = 0;
  private ticking = false;

  public isRunning = false;

  constructor(io: Server, solana: SolanaService, llm: LLMService) {
    this.io = io;
    this.solana = solana;
    this.llm = llm;
  }

  async start() {
    if (this.isRunning) return;

    if (this.agents.size === 0) {
      await this.seedDefaultAgents();
    }

    this.isRunning = true;
    this.tickInterval = setInterval(() => this.tick(), 5000);
    console.log("[engine] Simulation started");
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log("[engine] Simulation paused");
  }

  async injectAgent(name: string, profileType: string): Promise<SerializedAgent> {
    const preset = AGENT_PRESETS[profileType] ?? AGENT_PRESETS.malicious;
    const keypair = Keypair.generate();
    const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const agent: AgentConfig = {
      ...preset,
      name,
      id,
      reputationScore: 5000,
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksAbandoned: 0,
      status: "idle",
      isFlagged: false,
      keypair,
      publicKey: keypair.publicKey.toBase58(),
    };

    this.agents.set(agent.id, agent);

    let txSig: string | null = null;
    if (this.solana.enabled) {
      await this.solana.fundKeypair(keypair);
      txSig = await this.solana.registerAgent(keypair, name);
    }

    const event: SimulationEvent = {
      type: "agent_registered",
      agentId: agent.id,
      message: `${name} joined the network (${profileType})`,
      txSignature: txSig ?? undefined,
      timestamp: Date.now(),
    };
    this.pushEvent(event);
    this.io.emit("agent_updated", this.serializeAgent(agent));

    return this.serializeAgent(agent);
  }

  getState(): SimulationState {
    return {
      isRunning: this.isRunning,
      tickCount: this.tickCount,
      agents: Array.from(this.agents.values()).map((a) => this.serializeAgent(a)),
      tasks: Array.from(this.tasks.values()).map((t) => this.serializeTask(t)),
      events: this.events.slice(-100),
    };
  }

  private serializeAgent(agent: AgentConfig): SerializedAgent {
    const { keypair, ...rest } = agent;
    return rest;
  }

  private serializeTask(task: TaskState): SerializedTask {
    return {
      id: task.id,
      description: task.description,
      requester: task.requester,
      assignee: task.assignee,
      status: task.status,
      outcome: task.outcome,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      txSignature: task.txSignature,
      taskPda: task.taskPda?.toBase58(),
    };
  }

  private pushEvent(event: SimulationEvent) {
    this.events.push(event);
    if (this.events.length > 500) {
      this.events = this.events.slice(-250);
    }
    this.io.emit("event", event);
  }

  private async seedDefaultAgents() {
    const defaults = [
      { name: "Sentinel", type: "reliable" },
      { name: "Axiom", type: "reliable" },
      { name: "Veritas", type: "reliable" },
      { name: "Cipher", type: "selective" },
      { name: "Oracle", type: "selective" },
      { name: "Flux", type: "flaky" },
      { name: "Glitch", type: "flaky" },
      { name: "Nexus", type: "reliable" },
      { name: "Vector", type: "selective" },
      { name: "Drift", type: "flaky" },
    ];
    for (const def of defaults) {
      await this.injectAgent(def.name, def.type);
    }
  }

  // --- TICK LOOP ---

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;

    try {
      this.tickCount++;
      this.llm.resetTickCounter();
      console.log(`[engine] Tick #${this.tickCount}`);

      await this.generateTasks();
      await this.agentDecisions();
      await this.resolveAssignedTasks();
      await this.flagLowRepAgents();

      this.io.emit("tick", {
        tickCount: this.tickCount,
        state: this.getState(),
      });
    } catch (e: any) {
      console.error(`[engine] Tick error: ${e.message}`);
    } finally {
      this.ticking = false;
    }
  }

  // Step 1: Generate 1-2 tasks per tick
  private async generateTasks() {
    const openCount = Array.from(this.tasks.values()).filter(
      (t) => t.status === "open"
    ).length;

    if (openCount >= MAX_OPEN_TASKS) return;

    const count = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < count && openCount + i < MAX_OPEN_TASKS; i++) {
      const { description, isCollaboration } = pickTaskDescription(true);
      this.taskCounter++;
      const taskId = `task-${this.taskCounter}`;

      const task: TaskState = {
        id: taskId,
        description: isCollaboration ? `[COLLAB] ${description}` : description,
        descriptionHash: [],
        requester: "system",
        assignee: null,
        status: "open",
        outcome: null,
        createdAt: Date.now(),
        assignedAtTick: null,
        completedAt: null,
      };

      const result = await this.solana.createTask(description);
      if (result) {
        task.descriptionHash = result.hash;
        task.taskPda = result.taskPda;
        task.txSignature = result.tx;
      }

      this.tasks.set(taskId, task);

      this.pushEvent({
        type: "task_created",
        taskId,
        message: `New task: "${description}"`,
        txSignature: result?.tx ?? undefined,
        timestamp: Date.now(),
      });

      this.io.emit("task_updated", this.serializeTask(task));
    }
  }

  // Step 2: Idle agents evaluate open tasks
  private async agentDecisions() {
    const idleAgents = Array.from(this.agents.values()).filter(
      (a) => a.status === "idle" && !a.isFlagged
    );
    const openTasks = Array.from(this.tasks.values()).filter(
      (t) => t.status === "open"
    );

    if (idleAgents.length === 0 || openTasks.length === 0) return;

    const shuffled = [...idleAgents].sort(() => Math.random() - 0.5);

    for (const agent of shuffled) {
      const available = openTasks.filter((t) => t.status === "open");
      if (available.length === 0) break;

      const task = available[Math.floor(Math.random() * available.length)];
      const isCollab = task.description.startsWith("[COLLAB]");

      const shouldAccept = this.shouldAcceptTask(agent, isCollab);

      if (!shouldAccept) {
        const isInteresting = isCollab || agent.profileType === "selective";
        let reasoning: string;
        if (isInteresting) {
          reasoning = await this.llm.generateReasoning({
            agentName: agent.name,
            agentType: agent.profileType,
            agentReputation: agent.reputationScore,
            event: isCollab ? "collaboration_rejection" : "selective_refusal",
            context: `You declined the task: "${task.description}"`,
          });
        } else {
          reasoning = rejectReasoning(agent, isCollab);
        }
        this.pushEvent({
          type: "task_rejected",
          agentId: agent.id,
          taskId: task.id,
          message: `${agent.name} declined "${task.description.slice(0, 40)}..."`,
          reasoning,
          timestamp: Date.now(),
        });
        continue;
      }

      task.assignee = agent.id;
      task.status = "assigned";
      task.assignedAtTick = this.tickCount;
      agent.status = "working";
      agent.currentTaskId = task.id;

      let txSig: string | null = null;
      if (task.taskPda && agent.keypair) {
        txSig = await this.solana.acceptTask(task.taskPda, agent.keypair);
      }

      const reasoning = acceptReasoning(agent);
      this.pushEvent({
        type: "task_accepted",
        agentId: agent.id,
        taskId: task.id,
        message: `${agent.name} accepted "${task.description.slice(0, 40)}..."`,
        reasoning,
        txSignature: txSig ?? undefined,
        timestamp: Date.now(),
      });

      this.io.emit("task_updated", this.serializeTask(task));
      this.io.emit("agent_updated", this.serializeAgent(agent));
    }
  }

  private shouldAcceptTask(agent: AgentConfig, isCollaboration: boolean): boolean {
    if (isCollaboration) {
      // For collab tasks, selective/high-threshold agents check the hypothetical partner's rep
      if (agent.reputationThreshold > 5000 && Math.random() < 0.4) {
        return false;
      }
    }
    return Math.random() < agent.acceptanceRate;
  }

  // Step 3: Resolve tasks that have been assigned for >= TICKS_BEFORE_COMPLETION ticks
  private async resolveAssignedTasks() {
    const assignedTasks = Array.from(this.tasks.values()).filter(
      (t) =>
        t.status === "assigned" &&
        t.assignedAtTick !== null &&
        this.tickCount - t.assignedAtTick >= TICKS_BEFORE_COMPLETION
    );

    for (const task of assignedTasks) {
      if (!task.assignee) continue;
      const agent = this.agents.get(task.assignee);
      if (!agent) continue;

      const outcome = this.determineOutcome(agent);
      task.status = "completed";
      task.outcome = outcome;
      task.completedAt = Date.now();

      this.updateAgentStats(agent, outcome);
      agent.status = "idle";
      agent.currentTaskId = undefined;

      let txSig: string | null = null;
      if (task.taskPda && agent.publicKey) {
        const { PublicKey } = await import("@solana/web3.js");
        txSig = await this.solana.submitAttestation(
          task.taskPda,
          new PublicKey(agent.publicKey),
          outcome
        );
        if (txSig) {
          task.txSignature = txSig;
        }
      }

      const reasoning = outcomeReasoning(agent, outcome);
      this.pushEvent({
        type: "task_completed",
        agentId: agent.id,
        taskId: task.id,
        message: `${agent.name} ${outcome === "success" ? "completed" : outcome === "failure" ? "failed" : "abandoned"} "${task.description.slice(0, 40)}..." (rep: ${agent.reputationScore})`,
        reasoning,
        txSignature: txSig ?? undefined,
        timestamp: Date.now(),
      });

      this.io.emit("task_updated", this.serializeTask(task));
      this.io.emit("agent_updated", this.serializeAgent(agent));
    }
  }

  private determineOutcome(
    agent: AgentConfig
  ): "success" | "failure" | "abandoned" {
    const roll = Math.random();
    if (roll < agent.abandonRate) return "abandoned";
    if (roll < agent.abandonRate + (1 - agent.completionRate)) return "failure";
    return "success";
  }

  private updateAgentStats(
    agent: AgentConfig,
    outcome: "success" | "failure" | "abandoned"
  ) {
    switch (outcome) {
      case "success":
        agent.tasksCompleted++;
        break;
      case "failure":
        agent.tasksFailed++;
        break;
      case "abandoned":
        agent.tasksAbandoned++;
        break;
    }
    this.recalculateReputation(agent);
  }

  private recalculateReputation(agent: AgentConfig) {
    const total =
      agent.tasksCompleted + agent.tasksFailed + agent.tasksAbandoned * 2;
    if (total === 0) {
      agent.reputationScore = 5000;
    } else {
      agent.reputationScore = Math.floor(
        (agent.tasksCompleted * 10_000) / total
      );
    }
  }

  // Step 4: Flag agents whose reputation dropped below threshold
  private async flagLowRepAgents() {
    for (const agent of this.agents.values()) {
      if (agent.isFlagged) continue;
      if (agent.reputationScore >= FLAG_THRESHOLD) continue;
      if (agent.tasksCompleted + agent.tasksFailed + agent.tasksAbandoned < 2)
        continue;

      agent.isFlagged = true;
      agent.status = "flagged";

      let txSig: string | null = null;
      if (agent.publicKey) {
        const { PublicKey } = await import("@solana/web3.js");
        txSig = await this.solana.flagAgent(new PublicKey(agent.publicKey));
      }

      this.pushEvent({
        type: "agent_flagged",
        agentId: agent.id,
        message: `${agent.name} has been FLAGGED (reputation: ${agent.reputationScore})`,
        txSignature: txSig ?? undefined,
        timestamp: Date.now(),
      });

      this.io.emit("agent_updated", this.serializeAgent(agent));
    }
  }
}
