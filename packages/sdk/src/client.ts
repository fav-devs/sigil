import { Program, AnchorProvider } from "@coral-xyz/anchor";
import BN from "bn.js";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import type { AgentProfile, TaskAccount } from "./types.js";

const PROGRAM_ID = new PublicKey("4FFJDq6VQHrxoUyZrfVRaWX135unKNtfa7y6DNrjkhgw");

export class SigilClient {
  constructor(private program: Program, private provider: AnchorProvider) {}

  get programId(): PublicKey {
    return PROGRAM_ID;
  }

  findAgentPda(authority: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), authority.toBuffer()],
      PROGRAM_ID
    );
  }

  findVaultPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID);
  }

  findTaskPda(requester: PublicKey, descriptionHash: Buffer): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("task"), requester.toBuffer(), descriptionHash],
      PROGRAM_ID
    );
  }

  findAttestationPda(taskPda: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("attestation"), taskPda.toBuffer()],
      PROGRAM_ID
    );
  }

  async registerAgent(name: string, stakeLamports: number): Promise<string> {
    const authority = this.provider.wallet.publicKey;
    const [agentPda] = this.findAgentPda(authority);
    const [vaultPda] = this.findVaultPda();

    const tx = await this.program.methods
      .registerAgent(name, new BN(stakeLamports))
      .accounts({
        authority,
        agentProfile: agentPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async registerAgentWithKeypair(
    keypair: Keypair,
    name: string,
    stakeLamports: number
  ): Promise<string> {
    const [agentPda] = this.findAgentPda(keypair.publicKey);
    const [vaultPda] = this.findVaultPda();

    const tx = await this.program.methods
      .registerAgent(name, new BN(stakeLamports))
      .accounts({
        authority: keypair.publicKey,
        agentProfile: agentPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([keypair])
      .rpc();

    return tx;
  }

  async createTask(descriptionHash: number[]): Promise<{ tx: string; taskPda: PublicKey }> {
    const requester = this.provider.wallet.publicKey;
    const hashBuffer = Buffer.from(descriptionHash);
    const [taskPda] = this.findTaskPda(requester, hashBuffer);

    const tx = await this.program.methods
      .createTask(descriptionHash)
      .accounts({
        requester,
        task: taskPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx, taskPda };
  }

  async acceptTask(taskPda: PublicKey, agentKeypair: Keypair): Promise<string> {
    const [agentProfilePda] = this.findAgentPda(agentKeypair.publicKey);

    const tx = await this.program.methods
      .acceptTask()
      .accounts({
        agentAuthority: agentKeypair.publicKey,
        agentProfile: agentProfilePda,
        task: taskPda,
      })
      .signers([agentKeypair])
      .rpc();

    return tx;
  }

  async submitAttestation(
    taskPda: PublicKey,
    agentAuthority: PublicKey,
    outcome: { success: {} } | { failure: {} } | { abandoned: {} }
  ): Promise<string> {
    const attester = this.provider.wallet.publicKey;
    const [agentProfilePda] = this.findAgentPda(agentAuthority);
    const [attestationPda] = this.findAttestationPda(taskPda);

    const tx = await this.program.methods
      .submitAttestation(outcome)
      .accounts({
        attester,
        task: taskPda,
        agentProfile: agentProfilePda,
        attestation: attestationPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async flagAgent(agentProfilePda: PublicKey): Promise<string> {
    const caller = this.provider.wallet.publicKey;

    const tx = await this.program.methods
      .flagAgent()
      .accounts({
        caller,
        agentProfile: agentProfilePda,
      })
      .rpc();

    return tx;
  }

  async getAgentProfile(authority: PublicKey): Promise<AgentProfile> {
    const [pda] = this.findAgentPda(authority);
    return await (this.program.account as any).agentProfile.fetch(pda) as AgentProfile;
  }

  async getAllAgents(): Promise<{ publicKey: PublicKey; account: AgentProfile }[]> {
    const accounts = await (this.program.account as any).agentProfile.all();
    return accounts.map((a: any) => ({
      publicKey: a.publicKey as PublicKey,
      account: a.account as AgentProfile,
    }));
  }

  async getAllTasks(): Promise<{ publicKey: PublicKey; account: TaskAccount }[]> {
    const accounts = await (this.program.account as any).task.all();
    return accounts.map((t: any) => ({
      publicKey: t.publicKey as PublicKey,
      account: t.account as TaskAccount,
    }));
  }

  async getTasksByStatus(status: string): Promise<TaskAccount[]> {
    const allTasks = await (this.program.account as any).task.all();
    return allTasks
      .map((t: any) => t.account as TaskAccount)
      .filter((t: TaskAccount) => Object.keys(t.status)[0] === status);
  }
}
