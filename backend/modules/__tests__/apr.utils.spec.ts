import { mean, removeOutliers } from 'modules/apr/apr.utils';

describe('APR Utils', () => {
  it('calculates mean correctly', () => {
    expect(mean([1, 2, 3])).toBe(2);
  });

  it('removes outliers', () => {
    const data = [
      { timestamp: new Date(), yield: 1 },
      { timestamp: new Date(), yield: 2 },
      { timestamp: new Date(), yield: 100 }, // outlier
    ];

    const result = removeOutliers(data, 1.5);
    expect(result.length).toBeLessThan(data.length);
  });
});
