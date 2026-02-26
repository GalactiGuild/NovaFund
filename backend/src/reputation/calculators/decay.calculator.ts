import { DECAY_HALF_LIFE_DAYS } from '../Reputation.constants';

/**
 * Exponential time-decay weight.
 *
 * Returns a multiplier in (0, 1] that decreases as `occurredAt` recedes
 * into the past. The value reaches 0.5 exactly at DECAY_HALF_LIFE_DAYS.
 *
 * Formula:  weight = 2^(−ageDays / halfLife)
 *
 * Examples (halfLife = 180 days):
 *   age   0 days  → weight 1.000
 *   age  90 days  → weight 0.707
 *   age 180 days  → weight 0.500
 *   age 360 days  → weight 0.250
 *   age 720 days  → weight 0.063
 *
 * @param occurredAt  When the activity happened.
 * @param now         Reference point (injectable for testability).
 * @param halfLifeDays Override for testing different decay rates.
 */
export function timeDecayWeight(
  occurredAt: Date,
  now: Date = new Date(),
  halfLifeDays: number = DECAY_HALF_LIFE_DAYS,
): number {
  const msPerDay = 86_400_000;
  const ageDays = Math.max(0, (now.getTime() - occurredAt.getTime()) / msPerDay);
  return Math.pow(2, -ageDays / halfLifeDays);
}
