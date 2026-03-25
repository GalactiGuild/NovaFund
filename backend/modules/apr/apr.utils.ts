import { YieldDataPoint } from "./apr.types";

/**
 * Calculate mean
 */
export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function stdDev(values: number[]): number {
  const avg = mean(values);
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) /
    values.length;

  return Math.sqrt(variance);
}

/**
 * Remove outliers using Z-score
 */
export function removeOutliers(
  data: YieldDataPoint[],
  threshold = 2
): YieldDataPoint[] {
  const values = data.map((d) => d.yield);
  const avg = mean(values);
  const sd = stdDev(values);

  return data.filter((d) => {
    const z = (d.yield - avg) / sd;
    return Math.abs(z) <= threshold;
  });
}

/**
 * Moving average smoothing
 */
export function movingAverage(
  data: YieldDataPoint[],
  windowSize: number
): number {
  const sorted = [...data].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const recent = sorted.slice(-windowSize);

  return mean(recent.map((d) => d.yield));
}