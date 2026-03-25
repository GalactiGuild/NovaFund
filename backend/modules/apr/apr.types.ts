export interface YieldDataPoint {
  timestamp: Date;
  yield: number; // yield generated in that hour
}

export interface AprResult {
  apr: number;
  averageHourlyYield: number;
  projectedAnnualYield: number;
}

export interface AprConfig {
  smoothingWindow?: number; // e.g. 24 hours
  outlierThreshold?: number; // z-score threshold
}