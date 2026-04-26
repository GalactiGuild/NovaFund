import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { AccountingService } from './accounting.service';
import { EcosystemSyncService } from './ecosystem-sync.service';
import { OperationalCostBreakdown } from './dto/operational-cost.dto';
import { StellarEcosystemContext } from './dto/ecosystem.dto';

@Resolver()
export class StellarInsightsResolver {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly ecosystemSyncService: EcosystemSyncService,
  ) {}

  @Query(() => OperationalCostBreakdown, {
    name: 'monthlyOperationalCosts',
    description: 'Returns month-level platform gas usage and fee sponsorship totals.',
  })
  async getMonthlyOperationalCosts(
    @Args('year', { type: () => Int }) year: number,
    @Args('month', { type: () => Int }) month: number,
  ): Promise<OperationalCostBreakdown> {
    return this.accountingService.getMonthlyBreakdown(year, month);
  }

  @Query(() => StellarEcosystemContext, {
    name: 'stellarEcosystemContext',
    description: 'Returns latest top traded assets and DEX volume context from Stellar.',
  })
  async getStellarEcosystemContext(): Promise<StellarEcosystemContext> {
    const latest = await this.ecosystemSyncService.getLatestSnapshot();

    if (!latest) {
      const synced = await this.ecosystemSyncService.syncNow();
      return this.formatSnapshot(synced);
    }

    return this.formatSnapshot(latest);
  }

  private formatSnapshot(snapshot: any): StellarEcosystemContext {
    return {
      snapshotDate: snapshot.snapshotDate.toISOString(),
      capturedAt: snapshot.capturedAt.toISOString(),
      dexVolume24h: snapshot.dexVolume24h.toString(),
      rwaDexVolume24h: snapshot.rwaDexVolume24h.toString(),
      topTradedAssets: (snapshot.topTradedAssets ?? []).map((entry: any) => ({
        assetCode: entry.assetCode,
        assetIssuer: entry.assetIssuer,
        tradedVolume: entry.tradedVolume,
      })),
    };
  }
}
