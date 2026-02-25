use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    // General errors (start at 1)
    NotInitialized = 1,
    AlreadyInitialized,
    Unauthorized,
    InvalidInput,
    NotFound,

    // Project errors
    ProjectNotActive,
    ProjectAlreadyExists,
    FundingGoalNotReached,
    DeadlinePassed,
    InvalidProjectStatus,

<<<<<<< HEAD
    // Escrow errors (200-299)
    InsufficientEscrowBalance = 200,
    MilestoneNotApproved = 201,
    InvalidMilestoneStatus = 202,
    NotAValidator = 203,
    AlreadyVoted = 204,
    OracleUnauthorized = 205,
    OracleValidationFailed = 206,
    OracleDeadlineNotReached = 207,
    ContractPaused = 205,
    ResumeTooEarly = 206,
    UpgradeNotScheduled = 207,
    UpgradeTooEarly = 208,
    UpgradeRequiresPause = 209,
=======
    // Escrow errors
    InsufficientEscrowBalance,
    MilestoneNotApproved,
    InvalidMilestoneStatus,
    NotAValidator,
    AlreadyVoted,
    OracleUnauthorized,
    OracleValidationFailed,
    OracleDeadlineNotReached,
>>>>>>> ee22966 (fixed the build error)

    // Distribution errors
    InsufficientFunds,
    InvalidDistribution,
    NoClaimableAmount,
    DistributionFailed,

    // Subscription errors
    SubscriptionNotActive,
    InvalidSubscriptionPeriod,
    SubscriptionExists,
    WithdrawalLocked,

    // Reputation errors
    ReputationTooLow,
    InvalidReputationScore,
    BadgeNotEarned,
    UserAlreadyRegistered,
    BadgeAlreadyAwarded,
    UserNotRegistered,

    // Governance errors
    ProposalNotActive,
    InsufficientVotingPower,
    ProposalAlreadyExecuted,
    QuorumNotReached,

    // Cross-chain bridge errors
    BridgePaused,
    ChainNotSupported,
    InvalidChain,
    BridgeTransactionFailed,
    InsufficientConfirmations,
    RelayerNotRegistered,
    InvalidBridgeOperation,

<<<<<<< HEAD
    InvalidFundingGoal = 1000,
    InvalidDeadline = 1001,
    ProjectNotFound = 1002,
    ContributionTooLow = 1003,
    IdentityNotVerified = 1004,
=======
    InvalidFundingGoal,
    InvalidDeadline,
    ProjectNotFound,
    ContributionTooLow,
>>>>>>> ee22966 (fixed the build error)
}
