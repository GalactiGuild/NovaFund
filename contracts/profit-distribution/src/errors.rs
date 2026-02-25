use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidSharePercentage = 3,
    TotalSharesNot100 = 4,
    InsufficientBalance = 5,
    NothingToClaim = 6,
    AlreadyClaimed = 7,
    Unauthorized = 8,
    InvalidAmount = 9,
}
