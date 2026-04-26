import { AccountingService } from './accounting.service';

describe('AccountingService', () => {
  it('records fee events and updates daily aggregate', async () => {
    const tx = {
      operationalCostEvent: { create: jest.fn() },
      operationalCost: { upsert: jest.fn() },
    };

    const prisma = {
      $transaction: jest.fn(async (cb: (inner: typeof tx) => Promise<void>) => cb(tx)),
      operationalCost: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const service = new AccountingService(prisma as any);

    await service.recordHorizonFee('relay.submitTransaction', {
      fee_charged: '100',
      hash: 'abc',
      ledger: 123,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.operationalCostEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.operationalCost.upsert).toHaveBeenCalledTimes(1);
  });

  it('returns monthly breakdown with totals', async () => {
    const prisma = {
      $transaction: jest.fn(),
      operationalCost: {
        findMany: jest.fn().mockResolvedValue([
          { date: new Date('2026-04-01T00:00:00.000Z'), totalFeeCharged: 100n, eventCount: 2 },
          { date: new Date('2026-04-02T00:00:00.000Z'), totalFeeCharged: 300n, eventCount: 3 },
        ]),
      },
    };

    const service = new AccountingService(prisma as any);

    const result = await service.getMonthlyBreakdown(2026, 4);

    expect(result.totalFeeCharged).toBe('400');
    expect(result.totalEvents).toBe(5);
    expect(result.days).toHaveLength(2);
  });
});
