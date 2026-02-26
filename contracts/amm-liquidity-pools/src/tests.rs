#[cfg(test)]
mod sqrt_tests {
    #[test]
    fn test_sqrt_function() {
        // Test basic sqrt functionality
        assert_eq!(crate::AMMLiquidityPools::sqrt(0), 0);
        assert_eq!(crate::AMMLiquidityPools::sqrt(1), 1);
        assert_eq!(crate::AMMLiquidityPools::sqrt(4), 2);
        assert_eq!(crate::AMMLiquidityPools::sqrt(9), 3);
        assert_eq!(crate::AMMLiquidityPools::sqrt(16), 4);

        // Test larger numbers
        let result = crate::AMMLiquidityPools::sqrt(1_000_000);
        assert!((999..=1001).contains(&result)); // Allow for rounding
    }
}
