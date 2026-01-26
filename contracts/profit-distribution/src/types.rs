use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InvestorShare {
    pub investor: Address,
    pub share_percentage: u32, // basis points (e.g., 10000 = 100%)
    pub accumulated_at_last_update: i128,
    pub claimable_amount: i128,
    pub total_claimed: i128,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    ProjectToken(u64),           // project_id -> token address
    InvestorShare(u64, Address), // project_id, investor -> InvestorShare
    TotalShares(u64),            // project_id -> total registered shares
    AccProfitPerShare(u64),      // project_id -> accumulated profit per share
    Admin,
}
