import { Router } from "express";
import { Keypair, PublicKey } from "@solana/web3.js";
import type { SolanaService } from "../services/solana.js";

export function protocolRouter(solana: SolanaService): Router {
  const router = Router();

  // ── Agents ──────────────────────────────────────────────────────────

  router.post("/agents", async (req, res) => {
    const { name, stake } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required (string, max 32 chars)" });
      return;
    }

    const keypair = Keypair.generate();
    const stakeLamports = typeof stake === "number" ? stake : 100_000;

    try {
      await solana.fundKeypair(keypair);
      const tx = await solana.registerAgent(keypair, name, stakeLamports);

      res.json({
        publicKey: keypair.publicKey.toBase58(),
        secretKey: Array.from(keypair.secretKey),
        txSignature: tx,
        message: `Agent "${name}" registered on Sigil`,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/agents", async (_req, res) => {
    try {
      const agents = await solana.client.getAllAgents();
      res.json(
        agents.map((a) => ({
          publicKey: a.publicKey.toBase58(),
          name: a.account.name,
          reputationScore: Number(a.account.reputationScore),
          tasksCompleted: Number(a.account.tasksCompleted),
          tasksFailed: Number(a.account.tasksFailed),
          tasksAbandoned: Number(a.account.tasksAbandoned),
          isFlagged: a.account.isFlagged,
          stake: Number(a.account.stake),
          registeredAt: Number(a.account.registeredAt),
        }))
      );
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/agents/:pubkey", async (req, res) => {
    try {
      const authority = new PublicKey(req.params.pubkey);
      const profile = await solana.client.getAgentProfile(authority);
      res.json({
        authority: profile.authority.toBase58(),
        name: profile.name,
        reputationScore: Number(profile.reputationScore),
        tasksCompleted: Number(profile.tasksCompleted),
        tasksFailed: Number(profile.tasksFailed),
        tasksAbandoned: Number(profile.tasksAbandoned),
        isFlagged: profile.isFlagged,
        stake: Number(profile.stake),
        registeredAt: Number(profile.registeredAt),
      });
    } catch (e: any) {
      res.status(404).json({ error: `Agent not found: ${e.message}` });
    }
  });

  router.get("/agents/:pubkey/reputation", async (req, res) => {
    try {
      const authority = new PublicKey(req.params.pubkey);
      const score = await solana.getOnChainReputation(authority);
      if (score === null) {
        res.status(404).json({ error: "Agent not found or Solana disabled" });
        return;
      }
      res.json({ publicKey: req.params.pubkey, reputationScore: score });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Tasks ───────────────────────────────────────────────────────────

  router.post("/tasks", async (req, res) => {
    const { description } = req.body;
    if (!description || typeof description !== "string") {
      res.status(400).json({ error: "description is required (string)" });
      return;
    }

    try {
      const result = await solana.createTask(description);
      if (!result) {
        res.status(503).json({ error: "Solana is disabled" });
        return;
      }
      res.json({
        taskPda: result.taskPda.toBase58(),
        descriptionHash: result.hash,
        txSignature: result.tx,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/tasks", async (req, res) => {
    const status = (req.query.status as string) ?? undefined;
    try {
      if (status) {
        const tasks = await solana.client.getTasksByStatus(status);
        res.json(tasks.map(serializeTask));
      } else {
        const all = await solana.client.getAllTasks();
        res.json(
          all.map((t) => ({
            taskPda: t.publicKey.toBase58(),
            ...serializeTask(t.account),
          }))
        );
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/tasks/:taskPda/accept", async (req, res) => {
    const { secretKey } = req.body;
    if (!secretKey || !Array.isArray(secretKey)) {
      res.status(400).json({
        error: "secretKey is required (array of numbers — the agent's keypair)",
      });
      return;
    }

    try {
      const taskPda = new PublicKey(req.params.taskPda);
      const agentKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
      const tx = await solana.acceptTask(taskPda, agentKeypair);
      res.json({ txSignature: tx });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/tasks/:taskPda/attest", async (req, res) => {
    const { agentPubkey, outcome } = req.body;
    if (!agentPubkey || !outcome) {
      res.status(400).json({
        error: "agentPubkey (string) and outcome (success|failure|abandoned) required",
      });
      return;
    }
    if (!["success", "failure", "abandoned"].includes(outcome)) {
      res.status(400).json({ error: "outcome must be success, failure, or abandoned" });
      return;
    }

    try {
      const taskPda = new PublicKey(req.params.taskPda);
      const agentAuthority = new PublicKey(agentPubkey);
      const tx = await solana.submitAttestation(taskPda, agentAuthority, outcome);
      res.json({ txSignature: tx });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

function serializeTask(task: any) {
  return {
    requester: task.requester?.toBase58?.() ?? String(task.requester),
    assignee: task.assignee?.toBase58?.() ?? String(task.assignee),
    status: Object.keys(task.status)[0],
    outcome: task.outcome ? Object.keys(task.outcome)[0] : null,
    createdAt: Number(task.createdAt),
    completedAt: task.completedAt ? Number(task.completedAt) : null,
  };
}
