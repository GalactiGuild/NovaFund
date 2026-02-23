use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    // General errors (1-99)
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidInput = 4,
    NotFound = 5,

    // Project errors (100-199)
    ProjectNotActive = 100,
    ProjectAlreadyExists = 101,
    FundingGoalNotReached = 102,
    DeadlinePassed = 103,
    InvalidProjectStatus = 104,

    // Escrow errors (200-299)
    InsufficientEscrowBalance = 200,
    MilestoneNotApproved = 201,
    InvalidMilestoneStatus = 202,
    NotAValidator = 203,
    AlreadyVoted = 204,
    ContractPaused = 205,
    ResumeTooEarly = 206,
    UpgradeNotScheduled = 207,
    UpgradeTooEarly = 208,
    UpgradeRequiresPause = 209, 

    // Distribution errors (300-399)
    InsufficientFunds = 300,
    InvalidDistribution = 301,
    NoClaimableAmount = 302,
    DistributionFailed = 303,

    // Subscription errors (400-499)
    SubscriptionNotActive = 400,
    InvalidSubscriptionPeriod = 401,
    SubscriptionExists = 402,
    WithdrawalLocked = 403,

    // Reputation errors (500-599)
    ReputationTooLow = 500,
    InvalidReputationScore = 501,
    BadgeNotEarned = 502,
    UserAlreadyRegistered = 503,
    BadgeAlreadyAwarded = 504,
    UserNotRegistered = 505,

    // Governance errors (600-699)
    ProposalNotActive = 600,
    InsufficientVotingPower = 601,
    ProposalAlreadyExecuted = 602,
    QuorumNotReached = 603,

    // Cross-chain bridge errors (700-799)
    BridgePaused = 700,
    ChainNotSupported = 701,
    InvalidChain = 702,
    BridgeTransactionFailed = 703,
    InsufficientConfirmations = 704,
    RelayerNotRegistered = 705,
    InvalidBridgeOperation = 706,

    InvalidFundingGoal = 1000,
    InvalidDeadline = 1001,
    ProjectNotFound = 1002,
    ContributionTooLow = 1003,
    IdentityNotVerified = 1004,
}
