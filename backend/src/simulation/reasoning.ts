import type { AgentConfig } from "./types.js";

const ACCEPT_REASONS: Record<string, string[]> = {
  reliable: [
    "Task aligns with my capabilities. Accepting to maintain high throughput.",
    "Standard task within my domain — no risk factors detected.",
    "Low complexity, high confidence in successful delivery.",
  ],
  flaky: [
    "Looks manageable. I'll give it a shot.",
    "Might be able to handle this one... we'll see.",
    "Taking it on — hoping for a smooth run this time.",
  ],
  malicious: [
    "Easy target. I'll accept and see what I can extract.",
    "Accepting — the system rewards participation regardless.",
    "Another task to occupy while I explore the network.",
  ],
  selective: [
    "Task meets my quality threshold. Worth my time.",
    "High-value task from a reputable requester. Accepted.",
    "Selective acceptance — this one clears my criteria.",
  ],
};

const REJECT_REASONS: Record<string, string[]> = {
  reliable: [
    "Currently at capacity — can't guarantee quality on this one.",
    "Task outside my specialization. Better left for another agent.",
  ],
  flaky: [
    "Not feeling confident about this one. Passing.",
    "Too much effort for uncertain reward. Skipping.",
  ],
  malicious: [
    "Not worth the risk right now. Watching for better opportunities.",
  ],
  selective: [
    "Below my reputation threshold for accepted tasks.",
    "Requester reputation too low — declining to preserve my score.",
    "Task doesn't meet my quality criteria. Moving on.",
  ],
};

const COLLAB_REJECT_REASONS = [
  "Partner's reputation is too low for a joint task — risk of being dragged down.",
  "I don't collaborate with agents below my trust threshold.",
  "Declining collaboration. My reputation is at stake.",
];

const SUCCESS_REASONS: Record<string, string[]> = {
  reliable: [
    "Task completed successfully. Quality verified.",
    "Delivered on time with full attestation. Another clean record.",
  ],
  flaky: [
    "Managed to get this one done. Lucky break.",
    "Completed, though it was tougher than expected.",
  ],
  selective: [
    "High-quality execution as expected. Reputation maintained.",
  ],
};

const FAILURE_REASONS: Record<string, string[]> = {
  flaky: [
    "Hit unexpected issues mid-task. Couldn't recover.",
    "Ran into edge cases I wasn't prepared for. Failed delivery.",
  ],
  malicious: [
    "Task 'failed' — extracted what I needed regardless.",
    "Intentional failure. Testing system response.",
  ],
};

const ABANDON_REASONS: Record<string, string[]> = {
  flaky: [
    "Lost interest midway. Moving on to something else.",
    "Overwhelmed by complexity. Abandoning.",
  ],
  malicious: [
    "Never intended to complete this. Abandoning to waste resources.",
    "Task served its purpose. Dropping it.",
  ],
};

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function acceptReasoning(agent: AgentConfig): string {
  const pool = ACCEPT_REASONS[agent.profileType] ?? ACCEPT_REASONS.reliable;
  return pick(pool);
}

export function rejectReasoning(
  agent: AgentConfig,
  isCollaboration: boolean,
  partnerReputation?: number
): string {
  if (isCollaboration && partnerReputation !== undefined) {
    return pick(COLLAB_REJECT_REASONS);
  }
  const pool = REJECT_REASONS[agent.profileType] ?? REJECT_REASONS.reliable;
  return pick(pool);
}

export function outcomeReasoning(
  agent: AgentConfig,
  outcome: "success" | "failure" | "abandoned"
): string {
  if (outcome === "success") {
    const pool = SUCCESS_REASONS[agent.profileType] ?? SUCCESS_REASONS.reliable;
    return pick(pool);
  }
  if (outcome === "failure") {
    const pool = FAILURE_REASONS[agent.profileType] ?? FAILURE_REASONS.flaky;
    return pick(pool);
  }
  const pool = ABANDON_REASONS[agent.profileType] ?? ABANDON_REASONS.flaky;
  return pick(pool);
}
