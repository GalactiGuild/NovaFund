import { describe, it } from 'node:test';
import { timeDecayWeight } from './decay.calculator';

const NOW = new Date('2024-06-15T00:00:00.000Z');

const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

describe('timeDecayWeight', () => {
  it('returns 1.0 for an activity that happened right now', () => {
    expect(timeDecayWeight(NOW, NOW)).toBeCloseTo(1.0, 5);
  });

  it('returns 0.5 at exactly the half-life (180 days)', () => {
    expect(timeDecayWeight(daysAgo(180), NOW)).toBeCloseTo(0.5, 5);
  });

  it('returns 0.25 at double the half-life (360 days)', () => {
    expect(timeDecayWeight(daysAgo(360), NOW)).toBeCloseTo(0.25, 5);
  });

  it('returns ~0.707 at half the half-life (90 days)', () => {
    expect(timeDecayWeight(daysAgo(90), NOW)).toBeCloseTo(0.7071, 3);
  });

  it('returns 1.0 for a future activity (clamped to age = 0)', () => {
    const future = new Date(NOW.getTime() + 10 * 86_400_000);
    expect(timeDecayWeight(future, NOW)).toBeCloseTo(1.0, 5);
  });

  it('supports custom half-life override', () => {
    // half-life of 30 days → 0.5 at 30 days
    expect(timeDecayWeight(daysAgo(30), NOW, 30)).toBeCloseTo(0.5, 5);
  });

  it('produces a strictly decreasing sequence as age increases', () => {
    const weights = [0, 30, 90, 180, 365, 730].map((d) => timeDecayWeight(daysAgo(d), NOW));
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeLessThan(weights[i - 1]);
    }
  });
});
