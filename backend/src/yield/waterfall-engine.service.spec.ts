import { WaterfallEngineService, WaterfallTierRule } from './waterfall-engine.service';

describe('WaterfallEngineService', () => {
  const service = new WaterfallEngineService();

  it('allocates in tier order with capped tiers', () => {
    const tiers: WaterfallTierRule[] = [
      { tierOrder: 1, recipientType: 'INVESTORS', maxAmount: 100_000n },
      { tierOrder: 2, recipientType: 'CREATOR', maxAmount: 50_000n },
      { tierOrder: 3, recipientType: 'PLATFORM', maxAmount: null },
    ];

    const result = service.calculatePayout(220_000n, tiers);

    expect(result.allocations.INVESTORS).toBe(100_000n);
    expect(result.allocations.CREATOR).toBe(50_000n);
    expect(result.allocations.PLATFORM).toBe(70_000n);
    expect(result.unallocatedAmount).toBe(0n);
  });

  it('leaves remainder when tiers are fully capped', () => {
    const tiers: WaterfallTierRule[] = [
      { tierOrder: 1, recipientType: 'INVESTORS', maxAmount: 100_000n },
      { tierOrder: 2, recipientType: 'CREATOR', maxAmount: 50_000n },
    ];

    const result = service.calculatePayout(200_000n, tiers);

    expect(result.allocations.INVESTORS).toBe(100_000n);
    expect(result.allocations.CREATOR).toBe(50_000n);
    expect(result.unallocatedAmount).toBe(50_000n);
  });
});
