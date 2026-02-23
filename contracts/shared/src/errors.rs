use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidInput = 4,
    NotFound = 5,

    ProjectNotActive = 100,
    ProjectExists = 101,
    GoalNotReached = 102,
    DeadlinePassed = 103,
    InvalidStatus = 104,

    EscrowInsuf = 200,
    MilestoneNotAppr = 201,
    MilestoneStateInv = 202,
    NotAValidator = 203,
    AlreadyVoted = 204,

    DispNF = 205,
    MstoneContested = 206,
    JurorReg = 207,
    JurorStakeL = 208,
    NotJuror = 209,
    JurorActive = 210,
    VotePeriodNA = 211,
    RevealPeriodNA = 212,
    InvalidReveal = 213,
    AppealWinCl = 214,
    MaxAppeals = 215,
    AppealFeeL = 216,
    ConflictInt = 217,
}
// Temporarily removed other domains to debug macro panic
