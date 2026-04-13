import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Sigil } from "../target/types/sigil";

describe("sigil", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Sigil as Program<Sigil>;
  const authority = provider.wallet;

  it("registers an agent", async () => {
    const [agentPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), authority.publicKey.toBuffer()],
      program.programId
    );
    const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    const stakeAmount = new anchor.BN(100_000_000); // 0.1 SOL

    await program.methods
      .registerAgent("Agent Alpha", stakeAmount)
      .accounts({
        authority: authority.publicKey,
        agentProfile: agentPda,
        vault: vaultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const agent = await program.account.agentProfile.fetch(agentPda);
    expect(agent.name).to.equal("Agent Alpha");
    expect(agent.reputationScore.toNumber()).to.equal(5000);
    expect(agent.stake.toNumber()).to.equal(100_000_000);
  });

  it("creates a task", async () => {
    const descriptionHash = Buffer.alloc(32);
    Buffer.from("test-task-001").copy(descriptionHash);

    const [taskPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("task"), authority.publicKey.toBuffer(), descriptionHash],
      program.programId
    );

    await program.methods
      .createTask(Array.from(descriptionHash))
      .accounts({
        requester: authority.publicKey,
        task: taskPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const task = await program.account.task.fetch(taskPda);
    expect(task.requester.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(task.status).to.deep.equal({ open: {} });
  });
});
