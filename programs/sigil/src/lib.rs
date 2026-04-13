use anchor_lang::prelude::*;

mod state;
mod instructions;
mod errors;

use instructions::*;

declare_id!("4FFJDq6VQHrxoUyZrfVRaWX135unKNtfa7y6DNrjkhgw");

#[program]
pub mod sigil {
    use super::*;

    pub fn register_agent(ctx: Context<RegisterAgent>, name: String, stake_amount: u64) -> Result<()> {
        instructions::register_agent::handler(ctx, name, stake_amount)
    }

    pub fn create_task(ctx: Context<CreateTask>, description_hash: [u8; 32]) -> Result<()> {
        instructions::create_task::handler(ctx, description_hash)
    }

    pub fn accept_task(ctx: Context<AcceptTask>) -> Result<()> {
        instructions::accept_task::handler(ctx)
    }

    pub fn submit_attestation(ctx: Context<SubmitAttestation>, outcome: TaskOutcome) -> Result<()> {
        instructions::submit_attestation::handler(ctx, outcome)
    }

    pub fn flag_agent(ctx: Context<FlagAgent>) -> Result<()> {
        instructions::flag_agent::handler(ctx)
    }
}
