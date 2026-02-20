#![no_std]

pub mod constants;
pub mod errors;
pub mod events;
pub mod types;
pub mod utils;
pub mod upgradeable;

pub use constants::*;
pub use errors::*;
pub use events::*;
pub use types::*;
pub use utils::*;
pub use upgradeable::*;


pub fn calculate_percentage(amount: i128, percentage: u32, total_percentage: u32) -> i128 {
    // Calculate using i128 to avoid precision loss
    let numerator = amount as i128 * percentage as i128;
    numerator / total_percentage as i128
}
