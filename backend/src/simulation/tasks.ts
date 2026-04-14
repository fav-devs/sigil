const TASK_DESCRIPTIONS = [
  "Analyze market data for token price anomalies",
  "Verify smart contract audit report",
  "Aggregate cross-chain liquidity metrics",
  "Generate risk assessment for DeFi protocol",
  "Monitor governance proposal voting patterns",
  "Parse on-chain transaction history for wallet",
  "Classify NFT collection metadata quality",
  "Validate oracle price feed accuracy",
  "Summarize protocol documentation changes",
  "Detect unusual trading volume patterns",
  "Audit token distribution fairness",
  "Benchmark gas optimization strategies",
  "Compile regulatory compliance checklist",
  "Score DAO treasury diversification",
  "Evaluate bridge security parameters",
  "Index historical yield farming APYs",
  "Verify identity attestation credentials",
  "Analyze MEV extraction patterns",
  "Rate protocol governance decentralization",
  "Process cross-chain message verification",
];

const COLLAB_DESCRIPTIONS = [
  "Collaborate: Joint audit of cross-chain bridge contract",
  "Collaborate: Multi-agent consensus on oracle feed integrity",
  "Collaborate: Coordinated analysis of protocol exploit vector",
  "Collaborate: Peer review of risk model parameters",
  "Collaborate: Distributed verification of governance vote tally",
];

export function pickTaskDescription(allowCollab: boolean): {
  description: string;
  isCollaboration: boolean;
} {
  if (allowCollab && Math.random() < 0.2) {
    const desc =
      COLLAB_DESCRIPTIONS[Math.floor(Math.random() * COLLAB_DESCRIPTIONS.length)];
    return { description: desc, isCollaboration: true };
  }

  const desc =
    TASK_DESCRIPTIONS[Math.floor(Math.random() * TASK_DESCRIPTIONS.length)];
  return { description: desc, isCollaboration: false };
}
