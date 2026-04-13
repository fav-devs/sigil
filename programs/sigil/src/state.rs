use anchor_lang::prelude::*;

#[account]
pub struct AgentProfile {
    pub authority: Pubkey,
    pub name: String,
    pub registered_at: i64,
    pub tasks_completed: u64,
    pub tasks_failed: u64,
    pub tasks_abandoned: u64,
    pub reputation_score: u64,
    pub stake: u64,
    pub is_flagged: bool,
    pub bump: u8,
}

impl AgentProfile {
    pub const MAX_NAME_LEN: usize = 32;
    pub const SPACE: usize = 8  // discriminator
        + 32                     // authority
        + 4 + Self::MAX_NAME_LEN // name (string prefix + content)
        + 8                      // registered_at
        + 8                      // tasks_completed
        + 8                      // tasks_failed
        + 8                      // tasks_abandoned
        + 8                      // reputation_score
        + 8                      // stake
        + 1                      // is_flagged
        + 1;                     // bump

    pub fn recalculate_reputation(&mut self) {
        let total = self.tasks_completed + self.tasks_failed + self.tasks_abandoned * 2;
        if total == 0 {
            self.reputation_score = 5000;
        } else {
            self.reputation_score = (self.tasks_completed * 10_000) / total;
        }
    }
}

#[account]
pub struct Task {
    pub task_id: u64,
    pub requester: Pubkey,
    pub assignee: Pubkey,
    pub description_hash: [u8; 32],
    pub status: TaskStatus,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub outcome: Option<TaskOutcome>,
    pub bump: u8,
}

impl Task {
    pub const SPACE: usize = 8  // discriminator
        + 8                      // task_id
        + 32                     // requester
        + 32                     // assignee
        + 32                     // description_hash
        + 1                      // status (enum)
        + 8                      // created_at
        + 1 + 8                  // completed_at (Option<i64>)
        + 1 + 1                  // outcome (Option<enum>)
        + 1;                     // bump
}

#[account]
pub struct Attestation {
    pub task: Pubkey,
    pub attester: Pubkey,
    pub agent: Pubkey,
    pub outcome: TaskOutcome,
    pub timestamp: i64,
    pub bump: u8,
}

impl Attestation {
    pub const SPACE: usize = 8  // discriminator
        + 32                     // task
        + 32                     // attester
        + 32                     // agent
        + 1                      // outcome
        + 8                      // timestamp
        + 1;                     // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum TaskStatus {
    Open,
    Assigned,
    Completed,
    Disputed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum TaskOutcome {
    Success,
    Failure,
    Abandoned,
}
