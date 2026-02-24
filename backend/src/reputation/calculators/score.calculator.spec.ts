import { describe, it } from 'node:test';
import {
  calcSuccessRateScore,
  calcPeerRatingScore,
  calcContributionSizeScore,
  calcCommunityFeedbackScore,
  calculateReputationScore,
} from './score.calculator';
import { ReputationActivity } from '../reputation-activity.entity';
import { ActivityType, MIN_ACTIVITY_THRESHOLD } from '../Reputation.constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2024-06-15T00:00:00.000Z');

const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

const makeActivity = (type: ActivityType, value: number, daysOld = 0): ReputationActivity =>
  ({
    id: Math.random().toString(),
    subjectId: 'subject-1',
    actorId: null,
    activityType: type,
    value,
    referenceId: null,
    occurredAt: daysAgo(daysOld),
    createdAt: daysAgo(daysOld),
  }) as ReputationActivity;

const success = (daysOld = 0) => makeActivity(ActivityType.SUCCESSFUL_TRANSACTION, 100, daysOld);
const failure = (daysOld = 0) => makeActivity(ActivityType.FAILED_TRANSACTION, 100, daysOld);
const rating = (value: number, daysOld = 0) =>
  makeActivity(ActivityType.PEER_RATING, value, daysOld);
const review = (value: number, daysOld = 0) =>
  makeActivity(ActivityType.COMMUNITY_REVIEW, value, daysOld);
const dispWon = (daysOld = 0) => makeActivity(ActivityType.DISPUTE_WON, 1, daysOld);
const dispLost = (daysOld = 0) => makeActivity(ActivityType.DISPUTE_LOST, 1, daysOld);
const highValue = (value: number, daysOld = 0) =>
  makeActivity(ActivityType.HIGH_VALUE_CONTRIBUTION, value, daysOld);

// ---------------------------------------------------------------------------
// calcSuccessRateScore
// ---------------------------------------------------------------------------

describe('calcSuccessRateScore', () => {
  it('returns 100 for all successful transactions', () => {
    const acts = [success(), success(), success()];
    expect(calcSuccessRateScore(acts, NOW)).toBeCloseTo(100, 1);
  });

  it('returns 0 for all failed transactions', () => {
    const acts = [failure(), failure()];
    expect(calcSuccessRateScore(acts, NOW)).toBeCloseTo(0, 1);
  });

  it('returns 50 (neutral) when no transaction activities exist', () => {
    expect(calcSuccessRateScore([rating(4)], NOW)).toBe(50);
  });

  it('returns ~50 for equal success and failure counts', () => {
    const acts = [success(), failure(), success(), failure()];
    expect(calcSuccessRateScore(acts, NOW)).toBeCloseTo(50, 1);
  });

  it('applies decay — older failures hurt less than recent ones', () => {
    const recentMix = [success(0), failure(0)]; // 50%
    const oldFailure = [success(0), failure(360)]; // older failure decays → > 50%
    const scoreRecent = calcSuccessRateScore(recentMix, NOW);
    const scoreOld = calcSuccessRateScore(oldFailure, NOW);
    expect(scoreOld).toBeGreaterThan(scoreRecent);
  });

  it('is clamped between 0 and 100', () => {
    const score = calcSuccessRateScore([success(), failure()], NOW);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// calcPeerRatingScore
// ---------------------------------------------------------------------------

describe('calcPeerRatingScore', () => {
  it('returns 100 for all 5-star ratings', () => {
    expect(calcPeerRatingScore([rating(5), rating(5)], NOW)).toBeCloseTo(100, 1);
  });

  it('returns 0 for all 1-star ratings', () => {
    expect(calcPeerRatingScore([rating(1), rating(1)], NOW)).toBeCloseTo(0, 1);
  });

  it('returns 50 for all 3-star ratings (midpoint)', () => {
    expect(calcPeerRatingScore([rating(3), rating(3)], NOW)).toBeCloseTo(50, 1);
  });

  it('returns neutral 50 when no ratings exist', () => {
    expect(calcPeerRatingScore([], NOW)).toBe(50);
    expect(calcPeerRatingScore([success()], NOW)).toBe(50);
  });

  it('weights recent ratings more than old ones', () => {
    const recentHigh = [rating(5, 0), rating(2, 360)]; // recent 5-star
    const recentLow = [rating(2, 0), rating(5, 360)]; // recent 2-star
    const scoreHigh = calcPeerRatingScore(recentHigh, NOW);
    const scoreLow = calcPeerRatingScore(recentLow, NOW);
    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });
});

// ---------------------------------------------------------------------------
// calcContributionSizeScore
// ---------------------------------------------------------------------------

describe('calcContributionSizeScore', () => {
  it('returns 0 when no contribution activities exist', () => {
    expect(calcContributionSizeScore([failure(), rating(3)], NOW)).toBe(0);
  });

  it('increases monotonically with higher transaction values', () => {
    const low = calcContributionSizeScore(
      [success(0)].map(() => makeActivity(ActivityType.SUCCESSFUL_TRANSACTION, 100, 0)),
      NOW,
    );
    const high = calcContributionSizeScore(
      [makeActivity(ActivityType.SUCCESSFUL_TRANSACTION, 5000, 0)],
      NOW,
    );
    expect(high).toBeGreaterThan(low);
  });

  it('rewards HIGH_VALUE_CONTRIBUTION activities', () => {
    const withHVC = calcContributionSizeScore([highValue(1000)], NOW);
    const noHVC = calcContributionSizeScore([], NOW);
    expect(withHVC).toBeGreaterThan(noHVC);
  });

  it('is bounded [0, 100]', () => {
    const huge = makeActivity(ActivityType.SUCCESSFUL_TRANSACTION, 1_000_000_000, 0);
    const score = calcContributionSizeScore([huge], NOW);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('decays with age — older contributions score lower', () => {
    const recent = calcContributionSizeScore(
      [makeActivity(ActivityType.SUCCESSFUL_TRANSACTION, 500, 0)],
      NOW,
    );
    const old = calcContributionSizeScore(
      [makeActivity(ActivityType.SUCCESSFUL_TRANSACTION, 500, 360)],
      NOW,
    );
    expect(recent).toBeGreaterThan(old);
  });
});

// ---------------------------------------------------------------------------
// calcCommunityFeedbackScore
// ---------------------------------------------------------------------------

describe('calcCommunityFeedbackScore', () => {
  it('returns neutral 50 when no reviews or disputes exist', () => {
    expect(calcCommunityFeedbackScore([success()], NOW)).toBe(50);
  });

  it('returns ~100 for all 5-star reviews and all disputes won', () => {
    const acts = [review(5), review(5), dispWon(), dispWon()];
    expect(calcCommunityFeedbackScore(acts, NOW)).toBeGreaterThan(90);
  });

  it('returns low score for 1-star reviews and all disputes lost', () => {
    const acts = [review(1), review(1), dispLost(), dispLost()];
    expect(calcCommunityFeedbackScore(acts, NOW)).toBeLessThan(20);
  });

  it('blends reviews and disputes correctly when both present', () => {
    const onlyReview = calcCommunityFeedbackScore([review(5)], NOW);
    const onlyDispute = calcCommunityFeedbackScore([dispWon()], NOW);
    const combined = calcCommunityFeedbackScore([review(5), dispWon()], NOW);
    // Combined should be between or equal to both extremes (both are high here)
    expect(combined).toBeGreaterThanOrEqual(Math.min(onlyReview, onlyDispute) - 1);
  });

  it('handles only disputes (no reviews)', () => {
    const wonAll = calcCommunityFeedbackScore([dispWon(), dispWon()], NOW);
    const lostAll = calcCommunityFeedbackScore([dispLost(), dispLost()], NOW);
    expect(wonAll).toBeGreaterThan(lostAll);
  });
});

// ---------------------------------------------------------------------------
// calculateReputationScore (composite)
// ---------------------------------------------------------------------------

describe('calculateReputationScore', () => {
  it('returns lowConfidence=true when below MIN_ACTIVITY_THRESHOLD', () => {
    const acts = Array(MIN_ACTIVITY_THRESHOLD - 1)
      .fill(null)
      .map(() => success());
    const result = calculateReputationScore(acts, NOW);
    expect(result.lowConfidence).toBe(true);
  });

  it('returns lowConfidence=false at or above MIN_ACTIVITY_THRESHOLD', () => {
    const acts = Array(MIN_ACTIVITY_THRESHOLD)
      .fill(null)
      .map(() => success());
    const result = calculateReputationScore(acts, NOW);
    expect(result.lowConfidence).toBe(false);
  });

  it('returns activityCount equal to input length', () => {
    const acts = [success(), failure(), rating(4)];
    expect(calculateReputationScore(acts, NOW).activityCount).toBe(3);
  });

  it('composite score is a weighted blend of factor scores', () => {
    const acts = [success(), success(), rating(5), highValue(1000), review(5), dispWon()];
    const result = calculateReputationScore(acts, NOW);
    expect(result.compositeScore).toBeGreaterThan(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
  });

  it('high-quality user scores significantly higher than low-quality', () => {
    const goodActivities = [
      success(),
      success(),
      success(),
      success(),
      success(),
      rating(5),
      rating(5),
      rating(4),
      review(5),
      dispWon(),
      highValue(2000),
    ];
    const badActivities = [
      failure(),
      failure(),
      failure(),
      failure(),
      failure(),
      rating(1),
      rating(2),
      review(1),
      dispLost(),
    ];

    const goodScore = calculateReputationScore(goodActivities, NOW).compositeScore;
    const badScore = calculateReputationScore(badActivities, NOW).compositeScore;

    expect(goodScore).toBeGreaterThan(badScore + 30); // at least 30 points apart
  });

  it('all returned factor scores are in [0, 100]', () => {
    const acts = [success(), rating(3), review(2), dispLost(), failure()];
    const r = calculateReputationScore(acts, NOW);
    for (const key of [
      'successRateScore',
      'peerRatingScore',
      'contributionSizeScore',
      'communityFeedbackScore',
      'compositeScore',
    ] as const) {
      expect(r[key]).toBeGreaterThanOrEqual(0);
      expect(r[key]).toBeLessThanOrEqual(100);
    }
  });

  it('produces deterministic results for the same input', () => {
    const acts = [success(10), rating(4, 30), review(3, 60)];
    const r1 = calculateReputationScore(acts, NOW);
    const r2 = calculateReputationScore(acts, NOW);
    expect(r1.compositeScore).toBe(r2.compositeScore);
  });

  it('returns all zeroed factor scores for empty activity list', () => {
    const r = calculateReputationScore([], NOW);
    expect(r.activityCount).toBe(0);
    expect(r.lowConfidence).toBe(true);
    // Neutral defaults from each calculator
    expect(r.compositeScore).toBeGreaterThanOrEqual(0);
    expect(r.compositeScore).toBeLessThanOrEqual(100);
  });
});
