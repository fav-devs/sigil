pub mod register_agent;
pub mod create_task;
pub mod accept_task;
pub mod submit_attestation;
pub mod flag_agent;

pub use register_agent::*;
pub use create_task::*;
pub use accept_task::*;
pub use submit_attestation::*;
pub use flag_agent::*;

pub use crate::state::TaskOutcome;
