import { ReputationActivity } from '../reputation-activity.entity';
import {
  ActivityType,
  FACTOR_WEIGHTS,
  MAX_SCORE,
  MIN_ACTIVITY_THRESHOLD,
  MIN_SCORE,
} from '../reputation.constants';
import { timeDecayWeight } from './decay.calculator';

// ---------------------------------------------------------------------------
// Intermediate result types
// ---------------------------------------------------------------------------

export interface FactorScores {
  successRateScore:       number;
  peerRatingScore:        number;
  contributionSizeScore:  number;
  communityFeedbackScore: number;
}

export interface ScoreBreakdown extends FactorScores {
  compositeScore:  number;
  activityCount:   number;
  lowConfidence:   boolean;
}

// ---------------------------------------------------------------------------
// Factor calculators
// ---------------------------------------------------------------------------

/**
 * Success-rate factor (0–100).
 *
 * Ratio of decay-weighted successful transactions to all transaction outcomes.
 * A perfect 100% success rate yields 100; 0% yields 0.
 */
export function calcSuccessRateScore(
  activities: ReputationActivity[],
  now: Date,
): number {
  const transactionTypes = new Set([
    ActivityType.SUCCESSFUL_TRANSACTION,
    ActivityType.FAILED_TRANSACTION,
  ]);

  const transactions = activities.filter((a) => transactionTypes.has(a.activityType));
  if (transactions.length === 0) return 50; // neutral default — no data

  let weightedSuccess = 0;
  let weightedTotal   = 0;

  for (const tx of transactions) {
    const w = timeDecayWeight(tx.occurredAt, now);
    weightedTotal += w;
    if (tx.activityType === ActivityType.SUCCESSFUL_TRANSACTION) {
      weightedSuccess += w;
    }
  }

  return weightedTotal === 0 ? 50 : clamp((weightedSuccess / weightedTotal) * 100);
}

/**
 * Peer-rating factor (0–100).
 *
 * Decay-weighted mean of PEER_RATING values, normalised from a 1–5 scale
 * to 0–100. Falls back to 50 when no ratings exist.
 */
export function calcPeerRatingScore(
  activities: ReputationActivity[],
  now: Date,
): number {
  const ratings = activities.filter(
    (a) => a.activityType === ActivityType.PEER_RATING,
  );
  if (ratings.length === 0) return 50;

  let weightedSum   = 0;
  let weightedTotal = 0;

  for (const r of ratings) {
    const w = timeDecayWeight(r.occurredAt, now);
    weightedSum   += r.value * w;
    weightedTotal += w;
  }

  if (weightedTotal === 0) return 50;

  // Normalise 1–5 → 0–100
  const meanRating = weightedSum / weightedTotal;
  return clamp(((meanRating - 1) / 4) * 100);
}

/**
 * Contribution-size factor (0–100).
 *
 * Reward users who handle larger transactions and high-value contributions.
 * Uses a logarithmic scale so very large values don't dominate completely.
 *
 * Score = log10(1 + totalWeightedValue) / log10(1 + SCALE_CAP) × 100
 * where SCALE_CAP represents the value at which a user earns 100 points.
 */
export function calcContributionSizeScore(
  activities: ReputationActivity[],
  now: Date,
): number {
  const contributionTypes = new Set([
    ActivityType.SUCCESSFUL_TRANSACTION,
    ActivityType.HIGH_VALUE_CONTRIBUTION,
  ]);

  const relevant = activities.filter((a) => contributionTypes.has(a.activityType));
  if (relevant.length === 0) return 0;

  let weightedValue = 0;
  for (const a of relevant) {
    weightedValue += a.value * timeDecayWeight(a.occurredAt, now);
  }

  // SCALE_CAP: a user with this much weighted contribution value earns 100.
  const SCALE_CAP = 10_000;
  return clamp((Math.log10(1 + weightedValue) / Math.log10(1 + SCALE_CAP)) * 100);
}

/**
 * Community-feedback factor (0–100).
 *
 * Combines COMMUNITY_REVIEW ratings (normalised 1–5) and dispute outcomes
 * (DISPUTE_WON adds positive weight, DISPUTE_LOST subtracts).
 */
export function calcCommunityFeedbackScore(
  activities: ReputationActivity[],
  now: Date,
): number {
  const reviews  = activities.filter((a) => a.activityType === ActivityType.COMMUNITY_REVIEW);
  const disputes = activities.filter(
    (a) =>
      a.activityType === ActivityType.DISPUTE_WON ||
      a.activityType === ActivityType.DISPUTE_LOST,
  );

  if (reviews.length === 0 && disputes.length === 0) return 50;

  // Review sub-score (0–100), same normalisation as peer ratings.
  let reviewScore = 50;
  if (reviews.length > 0) {
    let wSum = 0, wTotal = 0;
    for (const r of reviews) {
      const w = timeDecayWeight(r.occurredAt, now);
      wSum   += r.value * w;
      wTotal += w;
    }
    reviewScore = wTotal > 0 ? clamp(((wSum / wTotal - 1) / 4) * 100) : 50;
  }

  // Dispute sub-score: net wins as a percentage of all disputes → 0–100.
  let disputeScore = 50;
  if (disputes.length > 0) {
    let wWon = 0, wLost = 0;
    for (const d of disputes) {
      const w = timeDecayWeight(d.occurredAt, now);
      if (d.activityType === ActivityType.DISPUTE_WON)  wWon  += w;
      else                                               wLost += w;
    }
    const total = wWon + wLost;
    disputeScore = total > 0 ? clamp((wWon / total) * 100) : 50;
  }

  // Blend: reviews carry more weight than dispute outcomes.
  const reviewWeight  = reviews.length  > 0 ? 0.7 : 0;
  const disputeWeight = disputes.length > 0 ? 0.3 : 0;
  const totalWeight   = reviewWeight + disputeWeight;

  if (totalWeight === 0) return 50;
  return clamp(
    (reviewScore * reviewWeight + disputeScore * disputeWeight) / totalWeight,
  );
}

// ---------------------------------------------------------------------------
// Composite calculator
// ---------------------------------------------------------------------------

/**
 * Compute the full multi-factor reputation score for a set of activities.
 *
 * This is a pure function with no side effects — safe to call from tests,
 * jobs, or API handlers without any DB interaction.
 *
 * @param activities  All reputation activities for the subject.
 * @param now         Reference timestamp (injectable for deterministic tests).
 */
export function calculateReputationScore(
  activities: ReputationActivity[],
  now: Date = new Date(),
): ScoreBreakdown {
  const activityCount = activities.length;
  const lowConfidence = activityCount < MIN_ACTIVITY_THRESHOLD;

  const successRateScore       = calcSuccessRateScore(activities, now);
  const peerRatingScore        = calcPeerRatingScore(activities, now);
  const contributionSizeScore  = calcContributionSizeScore(activities, now);
  const communityFeedbackScore = calcCommunityFeedbackScore(activities, now);

  const compositeScore = clamp(
    successRateScore       * FACTOR_WEIGHTS.SUCCESS_RATE       +
    peerRatingScore        * FACTOR_WEIGHTS.PEER_RATING        +
    contributionSizeScore  * FACTOR_WEIGHTS.CONTRIBUTION_SIZE  +
    communityFeedbackScore * FACTOR_WEIGHTS.COMMUNITY_FEEDBACK,
  );

  return {
    compositeScore:       round(compositeScore),
    successRateScore:     round(successRateScore),
    peerRatingScore:      round(peerRatingScore),
    contributionSizeScore: round(contributionSizeScore),
    communityFeedbackScore: round(communityFeedbackScore),
    activityCount,
    lowConfidence,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function clamp(value: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, value));
}

function round(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}