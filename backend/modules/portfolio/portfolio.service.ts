import { PortfolioRepository } from './portfolio.repository';
import { RoiResult } from './portfolio.types';

export class PortfolioService {
  constructor(private readonly repo: PortfolioRepository) {}

  async getUserPortfolioROI(userAddress: string): Promise<RoiResult> {
    const roiData = await this.repo.getUserROI(userAddress);

    return {
      ...roiData,
      roi: Number(roiData.roi.toFixed(4)), // clean output
    };
  }
}
