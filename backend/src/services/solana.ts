import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { SigilClient } from "@sigil/sdk";
import { createHash } from "crypto";

const IDL_STUB = {
  version: "0.1.0",
  name: "sigil",
  address: "4FFJDq6VQHrxoUyZrfVRaWX135unKNtfa7y6DNrjkhgw",
  instructions: [
    {
      name: "register_agent",
      discriminator: [135, 157, 66, 195, 2, 113, 175, 30],
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "agent_profile", writable: true },
        { name: "vault", writable: true },
        { name: "system_program" },
      ],
      args: [
        { name: "name", type: "string" },
        { name: "stake_amount", type: "u64" },
      ],
    },
    {
      name: "create_task",
      discriminator: [194, 80, 6, 180, 232, 127, 48, 171],
      accounts: [
        { name: "requester", writable: true, signer: true },
        { name: "task", writable: true },
        { name: "system_program" },
      ],
      args: [{ name: "description_hash", type: { array: ["u8", 32] } }],
    },
    {
      name: "accept_task",
      discriminator: [222, 196, 79, 165, 120, 30, 38, 120],
      accounts: [
        { name: "agent_authority", signer: true },
        { name: "agent_profile" },
        { name: "task", writable: true },
      ],
      args: [],
    },
    {
      name: "submit_attestation",
      discriminator: [238, 220, 255, 105, 183, 211, 40, 83],
      accounts: [
        { name: "attester", writable: true, signer: true },
        { name: "task", writable: true },
        { name: "agent_profile", writable: true },
        { name: "attestation", writable: true },
        { name: "system_program" },
      ],
      args: [
        {
          name: "outcome",
          type: { defined: { name: "TaskOutcome" } },
        },
      ],
    },
    {
      name: "flag_agent",
      discriminator: [235, 111, 155, 252, 101, 79, 59, 219],
      accounts: [
        { name: "caller", signer: true },
        { name: "agent_profile", writable: true },
      ],
      args: [],
    },
  ],
  accounts: [
    { name: "AgentProfile", discriminator: [60, 227, 42, 24, 0, 87, 86, 205] },
    { name: "Task", discriminator: [79, 34, 229, 55, 88, 90, 55, 84] },
    { name: "Attestation", discriminator: [152, 125, 183, 86, 36, 146, 121, 73] },
  ],
  types: [
    {
      name: "AgentProfile",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "name", type: "string" },
          { name: "registered_at", type: "i64" },
          { name: "tasks_completed", type: "u64" },
          { name: "tasks_failed", type: "u64" },
          { name: "tasks_abandoned", type: "u64" },
          { name: "reputation_score", type: "u64" },
          { name: "stake", type: "u64" },
          { name: "is_flagged", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Task",
      type: {
        kind: "struct",
        fields: [
          { name: "task_id", type: "u64" },
          { name: "requester", type: "pubkey" },
          { name: "assignee", type: "pubkey" },
          { name: "description_hash", type: { array: ["u8", 32] } },
          { name: "status", type: { defined: { name: "TaskStatus" } } },
          { name: "created_at", type: "i64" },
          { name: "completed_at", type: { option: "i64" } },
          { name: "outcome", type: { option: { defined: { name: "TaskOutcome" } } } },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Attestation",
      type: {
        kind: "struct",
        fields: [
          { name: "task", type: "pubkey" },
          { name: "attester", type: "pubkey" },
          { name: "agent", type: "pubkey" },
          { name: "outcome", type: { defined: { name: "TaskOutcome" } } },
          { name: "timestamp", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "TaskStatus",
      type: {
        kind: "enum",
        variants: [
          { name: "Open" },
          { name: "Assigned" },
          { name: "Completed" },
          { name: "Disputed" },
        ],
      },
    },
    {
      name: "TaskOutcome",
      type: {
        kind: "enum",
        variants: [
          { name: "Success" },
          { name: "Failure" },
          { name: "Abandoned" },
        ],
      },
    },
  ],
  errors: [],
} as any;

const PROGRAM_ID = new PublicKey(
  "4FFJDq6VQHrxoUyZrfVRaWX135unKNtfa7y6DNrjkhgw"
);

export class SolanaService {
  private connection: Connection;
  private serverKeypair: Keypair;
  private provider: AnchorProvider;
  private program: Program;
  client: SigilClient;
  enabled: boolean;

  constructor(rpcUrl: string, enabled: boolean) {
    this.enabled = enabled;
    this.connection = new Connection(rpcUrl, "confirmed");
    this.serverKeypair = Keypair.generate();

    const wallet = new Wallet(this.serverKeypair);
    this.provider = new AnchorProvider(this.connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });

    this.program = new Program(IDL_STUB, this.provider);
    this.client = new SigilClient(this.program, this.provider);
  }

  get serverPublicKey(): PublicKey {
    return this.serverKeypair.publicKey;
  }

  async initialize(): Promise<void> {
    if (!this.enabled) {
      console.log("[solana] Disabled — running in-memory only");
      return;
    }

    try {
      const version = await this.connection.getVersion();
      console.log(`[solana] Connected to cluster (version ${version["solana-core"]})`);
    } catch {
      console.warn("[solana] Could not connect to cluster — falling back to in-memory");
      this.enabled = false;
      return;
    }

    try {
      const sig = await this.connection.requestAirdrop(
        this.serverKeypair.publicKey,
        10 * LAMPORTS_PER_SOL
      );
      await this.connection.confirmTransaction(sig);
      const balance = await this.connection.getBalance(this.serverKeypair.publicKey);
      console.log(
        `[solana] Server wallet ${this.serverKeypair.publicKey.toBase58()} funded: ${balance / LAMPORTS_PER_SOL} SOL`
      );
    } catch (e: any) {
      console.warn(`[solana] Airdrop failed: ${e.message} — falling back to in-memory`);
      this.enabled = false;
    }
  }

  async fundKeypair(keypair: Keypair, solAmount = 2): Promise<void> {
    if (!this.enabled) return;
    const sig = await this.connection.requestAirdrop(
      keypair.publicKey,
      solAmount * LAMPORTS_PER_SOL
    );
    await this.connection.confirmTransaction(sig);
  }

  async registerAgent(
    keypair: Keypair,
    name: string,
    stakeLamports = 100_000
  ): Promise<string | null> {
    if (!this.enabled) return null;
    try {
      const tx = await this.client.registerAgentWithKeypair(
        keypair,
        name,
        stakeLamports
      );
      console.log(`[solana] registerAgent "${name}" tx: ${tx}`);
      return tx;
    } catch (e: any) {
      console.error(`[solana] registerAgent failed: ${e.message}`);
      return null;
    }
  }

  descriptionToHash(description: string): number[] {
    const hash = createHash("sha256").update(description).digest();
    return Array.from(hash);
  }

  async createTask(
    description: string
  ): Promise<{ tx: string; taskPda: PublicKey; hash: number[] } | null> {
    if (!this.enabled) return null;
    try {
      const hash = this.descriptionToHash(description);
      const result = await this.client.createTask(hash);
      console.log(`[solana] createTask tx: ${result.tx}`);
      return { tx: result.tx, taskPda: result.taskPda, hash };
    } catch (e: any) {
      console.error(`[solana] createTask failed: ${e.message}`);
      return null;
    }
  }

  async acceptTask(
    taskPda: PublicKey,
    agentKeypair: Keypair
  ): Promise<string | null> {
    if (!this.enabled) return null;
    try {
      const tx = await this.client.acceptTask(taskPda, agentKeypair);
      console.log(`[solana] acceptTask tx: ${tx}`);
      return tx;
    } catch (e: any) {
      console.error(`[solana] acceptTask failed: ${e.message}`);
      return null;
    }
  }

  async submitAttestation(
    taskPda: PublicKey,
    agentAuthority: PublicKey,
    outcome: "success" | "failure" | "abandoned"
  ): Promise<string | null> {
    if (!this.enabled) return null;
    try {
      const outcomeArg =
        outcome === "success"
          ? { success: {} }
          : outcome === "failure"
            ? { failure: {} }
            : { abandoned: {} };

      const tx = await this.client.submitAttestation(
        taskPda,
        agentAuthority,
        outcomeArg
      );
      console.log(`[solana] submitAttestation (${outcome}) tx: ${tx}`);
      return tx;
    } catch (e: any) {
      console.error(`[solana] submitAttestation failed: ${e.message}`);
      return null;
    }
  }

  async flagAgent(agentAuthority: PublicKey): Promise<string | null> {
    if (!this.enabled) return null;
    try {
      const [agentPda] = this.client.findAgentPda(agentAuthority);
      const tx = await this.client.flagAgent(agentPda);
      console.log(`[solana] flagAgent tx: ${tx}`);
      return tx;
    } catch (e: any) {
      console.error(`[solana] flagAgent failed: ${e.message}`);
      return null;
    }
  }

  async getOnChainReputation(
    agentAuthority: PublicKey
  ): Promise<number | null> {
    if (!this.enabled) return null;
    try {
      const profile = await this.client.getAgentProfile(agentAuthority);
      return Number(profile.reputationScore);
    } catch {
      return null;
    }
  }
}
