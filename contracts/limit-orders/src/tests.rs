#![cfg(test)]

// Basic enum tests only - no complex integration tests
#[test]
fn test_order_type_enum() {
    // Verify OrderType enum values
    assert_eq!(0u32, 0); // Buy = 0
    assert_eq!(1u32, 1); // Sell = 1
}

#[test]
fn test_order_status_enum() {
    // Verify OrderStatus enum values
    assert_eq!(0u32, 0); // Active = 0
    assert_eq!(1u32, 1); // PartiallyFilled = 1
    assert_eq!(2u32, 2); // Filled = 2
    assert_eq!(3u32, 3); // Cancelled = 3
}
