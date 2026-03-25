/**
 * Contract event types from Soroban smart contracts
 * Matches the event symbols defined in contracts/shared/src/events.rs
 */

export enum ContractEventType {
  // Project events
  PROJECT_CREATED = 'proj_new',
  PROJECT_FUNDED = 'proj_fund',
  PROJECT_COMPLETED = 'proj_done',
  PROJECT_FAILED = 'proj_fail',

  // Contribution events
  CONTRIBUTION_MADE = 'contrib',
  REFUND_ISSUED = 'refund',

  // Escrow events
  ESCROW_INITIALIZED = 'esc_init',
  FUNDS_LOCKED = 'lock',
  FUNDS_RELEASED = 'release',
  MILESTONE_CREATED = 'm_create',
  MILESTONE_SUBMITTED = 'm_submit',
  MILESTONE_APPROVED = 'm_apprv',
  MILESTONE_REJECTED = 'm_reject',
  MILESTONE_COMPLETED = 'milestone',
  VALIDATORS_UPDATED = 'v_update',

  // Distribution events
  PROFIT_DISTRIBUTED = 'profit',
  DIVIDEND_CLAIMED = 'claim',

  // Governance events
  PROPOSAL_CREATED = 'proposal',
  VOTE_CAST = 'vote',
  PROPOSAL_EXECUTED = 'execute',

  // Reputation events
  USER_REGISTERED = 'user_reg',
  REPUTATION_UPDATED = 'rep_up',
  BADGE_EARNED = 'badge',

  // Multi-party payment events
  PAYMENT_SETUP = 'pay_setup',
  PAYMENT_RECEIVED = 'pay_recv',
  PAYMENT_WITHDRAWN = 'pay_withd',

  // Subscription events
  SUBSCRIPTION_CREATED = 'subscr',
  SUBSCRIPTION_CANCELLED = 'sub_cancl',
  SUBSCRIPTION_MODIFIED = 'sub_mod',
  SUBSCRIPTION_PAUSED = 'sub_pause',
  SUBSCRIPTION_RESUMED = 'sub_resum',
  PAYMENT_FAILED = 'pay_fail',
  SUBSCRIPTION_PAYMENT = 'deposit',

  // Cross-chain bridge events
  BRIDGE_INITIALIZED = 'br_init',
  SUPPORTED_CHAIN_ADDED = 'chain_add',
  SUPPORTED_CHAIN_REMOVED = 'chain_rem',
  ASSET_WRAPPED = 'wrap',
  ASSET_UNWRAPPED = 'unwrap',
  BRIDGE_DEPOSIT = 'br_dep',
  BRIDGE_WITHDRAW = 'br_wdraw',
  BRIDGE_PAUSED = 'br_pause',
  BRIDGE_UNPAUSED = 'br_res',
  RELAYER_ADDED = 'rel_add',
  RELAYER_REMOVED = 'rel_rem',
  BRIDGE_TX_CONFIRMED = 'tx_conf',
  BRIDGE_TX_FAILED = 'tx_fail',

  // Contract lifecycle events
  CONTRACT_PAUSED = 'esc_pause',
  CONTRACT_RESUMED = 'esc_resum',
  UPGRADE_SCHEDULED = 'upg_sched',
  UPGRADE_EXECUTED = 'upg_exec',
  UPGRADE_CANCELLED = 'upg_canc',
}

/**
 * Raw event data from Stellar RPC
 */
export interface SorobanEvent {
  type: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId: string;
  id: string;
  pagingToken: string;
  topic: string[];
  value: string;
  inSuccessfulContractCall: boolean;
  txHash: string;
}

/**
 * Parsed contract event with structured data
 */
export interface ParsedContractEvent {
  eventId: string;
  ledgerSeq: number;
  ledgerClosedAt: Date;
  contractId: string;
  eventType: ContractEventType;
  transactionHash: string;
  data: Record<string, unknown>;
  inSuccessfulContractCall: boolean;
}

/**
 * Project created event data
 */
export interface ProjectCreatedEvent {
  projectId: number;
  creator: string;
  fundingGoal: string;
  deadline: number;
  token: string;
}

/**
 * Contribution made event data
 */
export interface ContributionMadeEvent {
  projectId: number;
  contributor: string;
  amount: string;
  totalRaised: string;
}

/**
 * Milestone approved event data
 */
export interface MilestoneApprovedEvent {
  projectId: number;
  milestoneId: number;
  approvalCount: number;
}

/**
 * Funds released event data
 */
export interface FundsReleasedEvent {
  projectId: number;
  milestoneId: number;
  amount: string;
}

/**
 * Project status changed event data
 */
export interface ProjectStatusEvent {
  projectId: number;
  status: 'completed' | 'failed';
}
