use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::AgentProfile;
use crate::errors::SigilError;

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = AgentProfile::SPACE,
        seeds = [b"agent", authority.key().as_ref()],
        bump,
    )]
    pub agent_profile: Account<'info, AgentProfile>,

    /// CHECK: PDA vault that holds staked SOL
    #[account(
        mut,
        seeds = [b"vault"],
        bump,
    )]
    pub vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RegisterAgent>, name: String, stake_amount: u64) -> Result<()> {
    require!(name.len() <= AgentProfile::MAX_NAME_LEN, SigilError::NameTooLong);
    require!(stake_amount > 0, SigilError::InsufficientStake);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        stake_amount,
    )?;

    let agent = &mut ctx.accounts.agent_profile;
    agent.authority = ctx.accounts.authority.key();
    agent.name = name;
    agent.registered_at = Clock::get()?.unix_timestamp;
    agent.tasks_completed = 0;
    agent.tasks_failed = 0;
    agent.tasks_abandoned = 0;
    agent.reputation_score = 5000;
    agent.stake = stake_amount;
    agent.is_flagged = false;
    agent.bump = ctx.bumps.agent_profile;

    Ok(())
}
