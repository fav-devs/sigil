import type { AgentConfig } from "./types.js";

type AgentPreset = Pick<
  AgentConfig,
  "profileType" | "acceptanceRate" | "completionRate" | "abandonRate" | "reputationThreshold" | "useLlmForDecisions"
>;

export const AGENT_PRESETS: Record<string, AgentPreset> = {
  reliable: {
    profileType: "reliable",
    acceptanceRate: 0.9,
    completionRate: 1.0,
    abandonRate: 0.0,
    reputationThreshold: 4000,
    useLlmForDecisions: false,
  },
  flaky: {
    profileType: "flaky",
    acceptanceRate: 0.7,
    completionRate: 0.7,
    abandonRate: 0.1,
    reputationThreshold: 2000,
    useLlmForDecisions: false,
  },
  malicious: {
    profileType: "malicious",
    acceptanceRate: 1.0,
    completionRate: 0.0,
    abandonRate: 1.0,
    reputationThreshold: 0,
    useLlmForDecisions: false,
  },
  selective: {
    profileType: "selective",
    acceptanceRate: 0.5,
    completionRate: 0.95,
    abandonRate: 0.0,
    reputationThreshold: 7000,
    useLlmForDecisions: true,
  },
};
