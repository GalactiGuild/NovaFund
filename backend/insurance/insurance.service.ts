import { Injectable } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PoolService } from './pool.service';
import { InsurancePolicy } from './entities/insurance-policy.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RiskType } from './enums/risk-type.enum';

@Injectable()
export class InsuranceService {
  constructor(
    private readonly pricing: PricingService,
    private readonly pools: PoolService,
    @InjectRepository(InsurancePolicy) private readonly repo: Repository<InsurancePolicy>,
  ) {}

  async purchasePolicy(userId: string, poolId: string, riskType: RiskType, coverageAmount: number) {
    const premium = this.pricing.calculatePremium(riskType, coverageAmount);
    await this.pools.lockCapital(poolId, coverageAmount);

    const policy = this.repo.create({ userId, poolId, riskType, coverageAmount, premium });
    return this.repo.save(policy);
  }
}
