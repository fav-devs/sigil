use anchor_lang::prelude::*;
use crate::state::AgentProfile;
use crate::errors::SigilError;

const FLAG_THRESHOLD: u64 = 2000;

#[derive(Accounts)]
pub struct FlagAgent<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        constraint = !agent_profile.is_flagged @ SigilError::AlreadyFlagged,
        constraint = agent_profile.reputation_score < FLAG_THRESHOLD @ SigilError::ReputationAboveThreshold,
    )]
    pub agent_profile: Account<'info, AgentProfile>,
}

pub fn handler(ctx: Context<FlagAgent>) -> Result<()> {
    ctx.accounts.agent_profile.is_flagged = true;
    Ok(())
}
