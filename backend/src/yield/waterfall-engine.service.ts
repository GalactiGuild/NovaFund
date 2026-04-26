import { Injectable } from '@nestjs/common';

export type WaterfallRecipient = 'INVESTORS' | 'CREATOR' | 'PLATFORM' | 'RESERVE';

export interface WaterfallTierRule {
  tierOrder: number;
  recipientType: WaterfallRecipient;
  maxAmount: bigint | null;
}

export interface WaterfallCalculationResult {
  allocations: Record<WaterfallRecipient, bigint>;
  unallocatedAmount: bigint;
}

@Injectable()
export class WaterfallEngineService {
  calculatePayout(totalPayout: bigint, tiers: WaterfallTierRule[]): WaterfallCalculationResult {
    if (totalPayout < 0n) {
      throw new Error('totalPayout must be non-negative');
    }

    const sorted = [...tiers].sort((a, b) => a.tierOrder - b.tierOrder);
    const allocations: Record<WaterfallRecipient, bigint> = {
      INVESTORS: 0n,
      CREATOR: 0n,
      PLATFORM: 0n,
      RESERVE: 0n,
    };

    let remaining = totalPayout;

    for (const tier of sorted) {
      if (remaining === 0n) {
        break;
      }

      if (tier.maxAmount !== null && tier.maxAmount <= 0n) {
        continue;
      }

      const tierBudget = tier.maxAmount === null ? remaining : remaining < tier.maxAmount ? remaining : tier.maxAmount;

      allocations[tier.recipientType] += tierBudget;
      remaining -= tierBudget;
    }

    return {
      allocations,
      unallocatedAmount: remaining,
    };
  }
}
