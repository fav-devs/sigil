use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::SigilError;

#[derive(Accounts)]
pub struct SubmitAttestation<'info> {
    #[account(mut)]
    pub attester: Signer<'info>,

    #[account(
        mut,
        constraint = task.requester == attester.key() @ SigilError::UnauthorizedAttester,
        constraint = task.status == TaskStatus::Assigned @ SigilError::TaskNotAssigned,
    )]
    pub task: Account<'info, Task>,

    #[account(
        mut,
        seeds = [b"agent", task.assignee.as_ref()],
        bump = agent_profile.bump,
    )]
    pub agent_profile: Account<'info, AgentProfile>,

    #[account(
        init,
        payer = attester,
        space = Attestation::SPACE,
        seeds = [b"attestation", task.key().as_ref()],
        bump,
    )]
    pub attestation: Account<'info, Attestation>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SubmitAttestation>, outcome: TaskOutcome) -> Result<()> {
    let task = &mut ctx.accounts.task;
    let agent = &mut ctx.accounts.agent_profile;
    let attestation = &mut ctx.accounts.attestation;

    task.status = TaskStatus::Completed;
    task.completed_at = Some(Clock::get()?.unix_timestamp);
    task.outcome = Some(outcome);

    match outcome {
        TaskOutcome::Success => agent.tasks_completed += 1,
        TaskOutcome::Failure => agent.tasks_failed += 1,
        TaskOutcome::Abandoned => agent.tasks_abandoned += 1,
    }
    agent.recalculate_reputation();

    attestation.task = task.key();
    attestation.attester = ctx.accounts.attester.key();
    attestation.agent = task.assignee;
    attestation.outcome = outcome;
    attestation.timestamp = Clock::get()?.unix_timestamp;
    attestation.bump = ctx.bumps.attestation;

    Ok(())
}
