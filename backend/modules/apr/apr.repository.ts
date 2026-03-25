import { YieldDataPoint } from "./apr.types";

export class AprRepository {
  async getHourlyYieldData(): Promise<YieldDataPoint[]> {
    // Replace with real DB/indexer call
    return [
      { timestamp: new Date(Date.now() - 3600 * 1000), yield: 0.5 },
      { timestamp: new Date(), yield: 0.7 },
    ];
  }
}