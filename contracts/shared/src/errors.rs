use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInit = 1,
    AlreadyInit = 2,
    Unauthorized = 3,
    InvInput = 4,
    NotFound = 5,

    // Project Errors
    ProjNotAct = 6,
    ProjExists = 7,
    GoalNotRch = 8,
    DeadlinePass = 9,
    InvStatus = 10,

    // Escrow Errors
    EscrowInsuf = 11,
    MstoneNotAppr = 12,
    MstoneInv = 13,
    NotValidator = 14,
    AlreadyVoted = 15,
    Paused = 16,
    ResTooEarly = 17,
    UpgNotSched = 18,
    UpgTooEarly = 19,
    UpgReqPause = 20, 

    // Dispute Resolution Errors
    DispNF = 21,
    MstoneContest = 22,
    JurorReg = 23,
    JurorStakeL = 24,
    NotJuror = 25,
    JurorAct = 26,
    VoteNA = 27,
    RevealNA = 28,
    InvReveal = 29,
    AppealWinCl = 30,
    MaxAppeals = 31,
    AppealFeeL = 32,
    ConflictInt = 33,

    // Distribution errors
    InsufFunds = 34,
    InvDist = 35,
    NoClaim = 36,
    DistFail = 37,

    // Subscription errors
    SubNotAct = 38,
    InvSubPer = 39,
    SubExists = 40,
    WithdrLock = 41,

    // Reputation errors
    RepErr = 42,
    BadgeNotErn = 43,
    UserAlreadyReg = 44,
    BadgeAw = 45,
    UserNotReg = 46,

    // Governance errors
    PropNotAct = 47,
    InsufVote = 48,
    PropExc = 49,
    QuorumNR = 50,
}
