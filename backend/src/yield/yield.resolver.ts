import { Resolver, Query } from '@nestjs/graphql';
import { YieldService } from './yield.service';
import { YieldStats } from './dto/yield-stats.dto';

@Resolver()
export class YieldResolver {
  constructor(private readonly yieldService: YieldService) {}

  @Query(() => YieldStats, {
    name: 'totalYield',
    description: 'Aggregates total yield generated across all active escrows',
  })
  async getTotalYield(): Promise<YieldStats> {
    return this.yieldService.getAggregatedYield();
  }
}
