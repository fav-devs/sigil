use anchor_lang::prelude::*;
use crate::state::{Task, TaskStatus};

#[derive(Accounts)]
#[instruction(description_hash: [u8; 32])]
pub struct CreateTask<'info> {
    #[account(mut)]
    pub requester: Signer<'info>,

    #[account(
        init,
        payer = requester,
        space = Task::SPACE,
        seeds = [b"task", requester.key().as_ref(), description_hash.as_ref()],
        bump,
    )]
    pub task: Account<'info, Task>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateTask>, description_hash: [u8; 32]) -> Result<()> {
    let task = &mut ctx.accounts.task;
    task.task_id = 0; // can be derived from PDA or set via counter
    task.requester = ctx.accounts.requester.key();
    task.assignee = Pubkey::default();
    task.description_hash = description_hash;
    task.status = TaskStatus::Open;
    task.created_at = Clock::get()?.unix_timestamp;
    task.completed_at = None;
    task.outcome = None;
    task.bump = ctx.bumps.task;

    Ok(())
}
