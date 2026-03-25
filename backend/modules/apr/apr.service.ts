import { AprRepository } from "./apr.repository";
import {
  AprConfig,
  AprResult,
  YieldDataPoint,
} from "./apr.types";
import {
  removeOutliers,
  movingAverage,
} from "./apr.utils";

const HOURS_IN_YEAR = 24 * 365;

export class AprService {
  constructor(private readonly repo: AprRepository) {}

  async calculateAPR(config: AprConfig = {}): Promise<AprResult> {
    const {
      smoothingWindow = 24,
      outlierThreshold = 2,
    } = config;

    const rawData: YieldDataPoint[] =
      await this.repo.getHourlyYieldData();

    if (!rawData.length) {
      return {
        apr: 0,
        averageHourlyYield: 0,
        projectedAnnualYield: 0,
      };
    }

    // Step 1: Remove outliers
    const cleaned = removeOutliers(
      rawData,
      outlierThreshold
    );

    // Step 2: Smooth using moving average
    const avgHourlyYield = movingAverage(
      cleaned,
      smoothingWindow
    );

    // Step 3: Annualize
    const projectedAnnualYield =
      avgHourlyYield * HOURS_IN_YEAR;

    const apr = projectedAnnualYield * 100;

    return {
      apr,
      averageHourlyYield: avgHourlyYield,
      projectedAnnualYield,
    };
  }
}