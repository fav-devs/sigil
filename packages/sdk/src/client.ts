import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import type { AgentProfile, TaskAccount } from "./types.js";

const PROGRAM_ID = new PublicKey("4FFJDq6VQHrxoUyZrfVRaWX135unKNtfa7y6DNrjkhgw");

export class SigilClient {
  constructor(private program: Program, private provider: AnchorProvider) {}

  private findAgentPda(authority: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), authority.toBuffer()],
      PROGRAM_ID
    );
  }

  private findVaultPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID);
  }

  private findTaskPda(requester: PublicKey, descriptionHash: Buffer): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("task"), requester.toBuffer(), descriptionHash],
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

  async createTask(descriptionHash: number[]): Promise<string> {
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

    return tx;
  }

  async acceptTask(taskPda: PublicKey): Promise<string> {
    const agentAuthority = this.provider.wallet.publicKey;
    const [agentProfilePda] = this.findAgentPda(agentAuthority);

    const tx = await this.program.methods
      .acceptTask()
      .accounts({
        agentAuthority,
        agentProfile: agentProfilePda,
        task: taskPda,
      })
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
    const [attestationPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("attestation"), taskPda.toBuffer()],
      PROGRAM_ID
    );

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

  async getAgentProfile(authority: PublicKey): Promise<AgentProfile> {
    const [pda] = this.findAgentPda(authority);
    return await this.program.account.agentProfile.fetch(pda) as unknown as AgentProfile;
  }

  async getAllAgents(): Promise<AgentProfile[]> {
    const accounts = await this.program.account.agentProfile.all();
    return accounts.map((a) => a.account as unknown as AgentProfile);
  }

  async getTasksByStatus(status: string): Promise<TaskAccount[]> {
    const allTasks = await this.program.account.task.all();
    return allTasks
      .map((t) => t.account as unknown as TaskAccount)
      .filter((t) => Object.keys(t.status)[0] === status);
  }
}
