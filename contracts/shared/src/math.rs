/// Safe arithmetic helpers for Soroban contracts.
///
/// All functions use `checked_*` operations and return `None` on overflow
/// instead of panicking. Callers should map `None` to an appropriate contract
/// error (e.g. `Error::InvInput` or a domain-specific overflow error).

/// Multiply two `i128` values, returning `None` on overflow.
#[inline]
pub fn checked_mul_i128(a: i128, b: i128) -> Option<i128> {
    a.checked_mul(b)
}

/// Divide two `i128` values, returning `None` on division-by-zero or overflow.
#[inline]
pub fn checked_div_i128(a: i128, b: i128) -> Option<i128> {
    a.checked_div(b)
}

/// Add two `i128` values, returning `None` on overflow.
#[inline]
pub fn checked_add_i128(a: i128, b: i128) -> Option<i128> {
    a.checked_add(b)
}

/// Subtract two `i128` values, returning `None` on overflow.
#[inline]
pub fn checked_sub_i128(a: i128, b: i128) -> Option<i128> {
    a.checked_sub(b)
}

/// Calculate `(amount * basis_points) / 10_000` safely.
///
/// `basis_points` is in the range 0–10_000 (0 %–100 %).
/// Returns `None` if the intermediate product overflows `i128`.
pub fn checked_bps(amount: i128, basis_points: u32) -> Option<i128> {
    checked_mul_i128(amount, basis_points as i128)
        .and_then(|n| checked_div_i128(n, 10_000))
}

/// Calculate `(amount * numerator) / denominator` safely.
///
/// Returns `None` on overflow or division-by-zero.
pub fn checked_muldiv(amount: i128, numerator: i128, denominator: i128) -> Option<i128> {
    checked_mul_i128(amount, numerator)
        .and_then(|n| checked_div_i128(n, denominator))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checked_bps_normal() {
        // 5% of 1_000_000
        assert_eq!(checked_bps(1_000_000, 500), Some(50_000));
        // 100% of 1_000_000
        assert_eq!(checked_bps(1_000_000, 10_000), Some(1_000_000));
        // 0%
        assert_eq!(checked_bps(1_000_000, 0), Some(0));
    }

    #[test]
    fn test_checked_bps_overflow() {
        // i128::MAX * 10_000 overflows
        assert_eq!(checked_bps(i128::MAX, 10_000), None);
    }

    #[test]
    fn test_checked_muldiv_normal() {
        // (1_000 * 6_000) / 10_000 = 600
        assert_eq!(checked_muldiv(1_000, 6_000, 10_000), Some(600));
    }

    #[test]
    fn test_checked_muldiv_div_zero() {
        assert_eq!(checked_muldiv(1_000, 6_000, 0), None);
    }

    #[test]
    fn test_checked_muldiv_overflow() {
        assert_eq!(checked_muldiv(i128::MAX, i128::MAX, 1), None);
    }

    #[test]
    fn test_checked_add_overflow() {
        assert_eq!(checked_add_i128(i128::MAX, 1), None);
    }

    #[test]
    fn test_checked_sub_overflow() {
        assert_eq!(checked_sub_i128(i128::MIN, 1), None);
    }
}
