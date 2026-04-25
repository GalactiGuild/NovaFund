use soroban_sdk::Env;

use crate::math::checked_bps;
use crate::types::{Amount, BasisPoints};

/// Calculate percentage of an amount using basis points.
/// Returns 0 on overflow instead of panicking.
pub fn calculate_percentage(amount: Amount, basis_points: BasisPoints) -> Amount {
    checked_bps(amount, basis_points).unwrap_or(0)
}

/// Calculate fee from amount using basis points.
/// Returns 0 on overflow instead of panicking.
pub fn calculate_fee(amount: Amount, fee_rate: BasisPoints) -> Amount {
    calculate_percentage(amount, fee_rate)
}

/// Verify timestamp is in the future
pub fn verify_future_timestamp(env: &Env, timestamp: u64) -> bool {
    timestamp > env.ledger().timestamp()
}

/// Verify timestamp is in the past
pub fn verify_past_timestamp(env: &Env, timestamp: u64) -> bool {
    timestamp <= env.ledger().timestamp()
}

/// Calculate proportional share.
/// Returns 0 on overflow instead of panicking.
pub fn calculate_share(total_amount: Amount, share_percentage: BasisPoints) -> Amount {
    calculate_percentage(total_amount, share_percentage)
}

/// Validate basis points (must be <= 10000)
pub fn validate_basis_points(basis_points: BasisPoints) -> bool {
    basis_points <= 10000
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_percentage() {
        // 25% of 1000
        assert_eq!(calculate_percentage(1000, 2500), 250);

        // 100% of 1000
        assert_eq!(calculate_percentage(1000, 10000), 1000);

        // 1% of 1000
        assert_eq!(calculate_percentage(1000, 100), 10);
    }

    #[test]
    fn test_validate_basis_points() {
        assert!(validate_basis_points(0));
        assert!(validate_basis_points(5000));
        assert!(validate_basis_points(10000));
        assert!(!validate_basis_points(10001));
    }
}
