import type { Server } from "socket.io";
import type { AgentConfig, SimulationState, SimulationEvent } from "./types.js";
import { AGENT_PRESETS } from "./agents.js";

export class SimulationEngine {
  private io: Server;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private agents: Map<string, AgentConfig> = new Map();
  private events: SimulationEvent[] = [];
  private tickCount = 0;

  public isRunning = false;

  constructor(io: Server) {
    this.io = io;
  }

  start() {
    if (this.isRunning) return;

    if (this.agents.size === 0) {
      this.seedDefaultAgents();
    }

    this.isRunning = true;
    this.tickInterval = setInterval(() => this.tick(), 4000);
    console.log("Simulation started");
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log("Simulation paused");
  }

  injectAgent(name: string, profileType: string): AgentConfig {
    const preset = AGENT_PRESETS[profileType] ?? AGENT_PRESETS.malicious;
    const agent: AgentConfig = {
      ...preset,
      name,
      id: `agent-${Date.now()}`,
      reputationScore: 5000,
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksAbandoned: 0,
      status: "idle",
      isFlagged: false,
    };
    this.agents.set(agent.id, agent);

    const event: SimulationEvent = {
      type: "agent_registered",
      agentId: agent.id,
      message: `${name} joined the network as a new agent`,
      timestamp: Date.now(),
    };
    this.events.push(event);
    this.io.emit("agent_updated", agent);
    this.io.emit("event", event);

    return agent;
  }

  getState(): SimulationState {
    return {
      isRunning: this.isRunning,
      tickCount: this.tickCount,
      agents: Array.from(this.agents.values()),
      events: this.events.slice(-50),
    };
  }

  private seedDefaultAgents() {
    const defaults = [
      { name: "Agent Alpha", type: "reliable" },
      { name: "Agent Beta", type: "reliable" },
      { name: "Agent Gamma", type: "flaky" },
      { name: "Agent Delta", type: "selective" },
      { name: "Agent Epsilon", type: "reliable" },
    ];
    for (const def of defaults) {
      this.injectAgent(def.name, def.type);
    }
  }

  private async tick() {
    this.tickCount++;
    console.log(`Tick #${this.tickCount}`);

    // TODO: implement full tick loop
    // 1. Generate tasks
    // 2. Agent decision-making (accept/reject)
    // 3. Task execution (based on agent profile)
    // 4. Attestation + reputation update
    // 5. Broadcast state

    this.io.emit("tick", { tickCount: this.tickCount });
  }
}
