#![no_std]

pub mod constants;
pub mod errors;
pub mod events;
pub mod math;
pub mod types;
pub mod utils;

pub use constants::*;
pub use errors::*;
pub use events::*;
pub use math::*;
pub use types::*;
pub use utils::*;

/// Calculate `(amount * percentage) / total_percentage`.
///
/// Returns 0 on overflow or division-by-zero rather than panicking.
pub fn calculate_percentage(amount: i128, percentage: u32, total_percentage: u32) -> i128 {
    if total_percentage == 0 {
        return 0;
    }
    math::checked_muldiv(amount, percentage as i128, total_percentage as i128).unwrap_or(0)
}
