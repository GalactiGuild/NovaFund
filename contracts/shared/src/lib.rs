#![no_std]

pub mod types;
pub mod errors;
pub mod events;
pub mod utils;
pub mod constants;

pub use types::*;
pub use errors::*;
pub use events::*;
pub use utils::*;
pub use constants::*;


pub fn calculate_percentage(amount: i128, percentage: u32, total_percentage: u32) -> i128 {
    // Calculate using i128 to avoid precision loss
    let numerator = amount as i128 * percentage as i128;
    numerator / total_percentage as i128
}