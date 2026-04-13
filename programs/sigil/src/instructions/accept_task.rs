use anchor_lang::prelude::*;
use crate::state::{Task, TaskStatus, AgentProfile};
use crate::errors::SigilError;

#[derive(Accounts)]
pub struct AcceptTask<'info> {
    pub agent_authority: Signer<'info>,

    #[account(
        seeds = [b"agent", agent_authority.key().as_ref()],
        bump = agent_profile.bump,
    )]
    pub agent_profile: Account<'info, AgentProfile>,

    #[account(
        mut,
        constraint = task.status == TaskStatus::Open @ SigilError::TaskNotOpen,
    )]
    pub task: Account<'info, Task>,
}

pub fn handler(ctx: Context<AcceptTask>) -> Result<()> {
    let task = &mut ctx.accounts.task;
    task.assignee = ctx.accounts.agent_authority.key();
    task.status = TaskStatus::Assigned;

    Ok(())
}
