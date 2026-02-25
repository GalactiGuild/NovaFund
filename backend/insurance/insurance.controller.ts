import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { InsuranceService } from './insurance.service';
import { ClaimService } from './claim.service';
import { ReinsuranceService } from './reinsurance.service';
import { RiskType } from './enums/risk-type.enum';

@Controller('api/insurance')
export class InsuranceController {
  constructor(
    private readonly insurance: InsuranceService,
    private readonly claims: ClaimService,
    private readonly reinsurance: ReinsuranceService,
  ) {}

  @Post('purchase')
  async purchase(@Body() body: { userId: string; poolId: string; riskType: RiskType; coverageAmount: number }) {
    return this.insurance.purchasePolicy(body.userId, body.poolId, body.riskType, body.coverageAmount);
  }

  @Post('claims/:claimId/assess')
  async assessClaim(@Param('claimId') claimId: string) {
    return this.claims.assessClaim(claimId);
  }

  @Post('claims/:claimId/pay')
  async payClaim(@Param('claimId') claimId: string) {
    return this.claims.payClaim(claimId);
  }

  @Post('reinsurance')
  async createReinsurance(@Body() body: { poolId: string; coverageLimit: number; premiumRate: number }) {
    return this.reinsurance.createContract(body.poolId, body.coverageLimit, body.premiumRate);
  }
}
