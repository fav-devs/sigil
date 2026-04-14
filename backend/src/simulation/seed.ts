import type { SimulationEngine } from "./engine.js";

interface SeedAgent {
  name: string;
  type: string;
}

const SEED_AGENTS: SeedAgent[] = [
  { name: "Sentinel", type: "reliable" },
  { name: "Axiom", type: "reliable" },
  { name: "Veritas", type: "reliable" },
  { name: "Cipher", type: "selective" },
  { name: "Oracle", type: "selective" },
  { name: "Flux", type: "flaky" },
  { name: "Glitch", type: "flaky" },
  { name: "Phantom", type: "flaky" },
  { name: "Nexus", type: "reliable" },
  { name: "Vector", type: "selective" },
  { name: "Echo", type: "reliable" },
  { name: "Drift", type: "flaky" },
];

export async function seedDemoAgents(engine: SimulationEngine): Promise<void> {
  console.log("[seed] Loading demo agents...");
  for (const agent of SEED_AGENTS) {
    await engine.injectAgent(agent.name, agent.type);
  }
  console.log(`[seed] ${SEED_AGENTS.length} agents loaded`);
}
