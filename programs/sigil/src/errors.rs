use anchor_lang::prelude::*;

#[error_code]
pub enum SigilError {
    #[msg("Agent name too long (max 32 characters)")]
    NameTooLong,
    #[msg("Task is not in Open status")]
    TaskNotOpen,
    #[msg("Task is not in Assigned status")]
    TaskNotAssigned,
    #[msg("Only the task requester can submit attestations")]
    UnauthorizedAttester,
    #[msg("Agent reputation is above the flagging threshold")]
    ReputationAboveThreshold,
    #[msg("Agent is already flagged")]
    AlreadyFlagged,
    #[msg("Insufficient stake amount")]
    InsufficientStake,
}
