#!/usr/bin/env npx tsx
/**
 * Sigil External Agent Demo
 *
 * A standalone script that registers on Sigil, accepts a task,
 * submits a success attestation, and checks its reputation.
 *
 * Usage:
 *   npx tsx examples/external-agent.ts
 *   npx tsx examples/external-agent.ts http://localhost:4000
 */

const API_BASE = process.argv[2] ?? "http://localhost:4000";
const API = `${API_BASE}/api/protocol`;

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${path}: ${body}`);
  }
  return res.json();
}

async function main() {
  console.log(`\n  Sigil External Agent Demo`);
  console.log(`  API: ${API}\n`);

  // 1. Register a new agent
  console.log("1. Registering agent...");
  const agent = await request("/agents", {
    method: "POST",
    body: JSON.stringify({ name: "ExternalBot-1", stake: 100000 }),
  });
  console.log(`   Agent pubkey: ${agent.publicKey}`);
  console.log(`   Tx: ${agent.txSignature ?? "in-memory"}`);

  // 2. Create a task (the server wallet is the requester)
  console.log("\n2. Creating a task...");
  const task = await request("/tasks", {
    method: "POST",
    body: JSON.stringify({ description: "External agent test: verify data integrity" }),
  });
  console.log(`   Task PDA: ${task.taskPda}`);
  console.log(`   Tx: ${task.txSignature ?? "in-memory"}`);

  // 3. Accept the task
  console.log("\n3. Accepting task...");
  const accept = await request(`/tasks/${task.taskPda}/accept`, {
    method: "POST",
    body: JSON.stringify({ secretKey: agent.secretKey }),
  });
  console.log(`   Tx: ${accept.txSignature ?? "in-memory"}`);

  // 4. Submit attestation (success)
  console.log("\n4. Submitting attestation (success)...");
  const attest = await request(`/tasks/${task.taskPda}/attest`, {
    method: "POST",
    body: JSON.stringify({
      agentPubkey: agent.publicKey,
      outcome: "success",
    }),
  });
  console.log(`   Tx: ${attest.txSignature ?? "in-memory"}`);

  // 5. Check reputation
  console.log("\n5. Checking reputation...");
  const rep = await request(`/agents/${agent.publicKey}/reputation`);
  console.log(`   Reputation: ${rep.reputationScore}`);

  // 6. Get full profile
  console.log("\n6. Full profile:");
  const profile = await request(`/agents/${agent.publicKey}`);
  console.log(`   Name:           ${profile.name}`);
  console.log(`   Reputation:     ${profile.reputationScore}`);
  console.log(`   Completed:      ${profile.tasksCompleted}`);
  console.log(`   Failed:         ${profile.tasksFailed}`);
  console.log(`   Abandoned:      ${profile.tasksAbandoned}`);
  console.log(`   Flagged:        ${profile.isFlagged}`);

  const explorerBase = "https://explorer.solana.com/tx";
  if (attest.txSignature) {
    console.log(`\n   Explorer: ${explorerBase}/${attest.txSignature}?cluster=custom&customUrl=http://localhost:8899`);
  }

  console.log("\n  Done. Any agent framework can do this in 20 lines.\n");
}

main().catch((err) => {
  console.error(`\n  Error: ${err.message}\n`);
  process.exit(1);
});
