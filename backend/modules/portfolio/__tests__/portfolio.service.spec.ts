import { PortfolioService } from '../portfolio.service';
import { PortfolioRepository } from '../portfolio.repository';

describe('PortfolioService', () => {
  it('returns ROI data', async () => {
    const mockRepo: Partial<PortfolioRepository> = {
      getUserROI: jest.fn().mockResolvedValue({
        totalInvested: 1000,
        totalReturns: 200,
        totalYield: 100,
        roi: 0.3,
      }),
    };

    const service = new PortfolioService(mockRepo as PortfolioRepository);

    const result = await service.getUserPortfolioROI('0x123');

    expect(result.roi).toBe(0.3);
    expect(result.totalInvested).toBe(1000);
  });
});
