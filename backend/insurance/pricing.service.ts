import { Injectable } from '@nestjs/common';
import { RiskType } from './enums/risk-type.enum';

@Injectable()
export class PricingService {
  calculatePremium(riskType: RiskType, coverageAmount: number): number {
    const baseRates = {
      [RiskType.PROJECT_FAILURE]: 0.05,
      [RiskType.SMART_CONTRACT_EXPLOIT]: 0.08,
      [RiskType.MARKET_VOLATILITY]: 0.03,
    };
    return coverageAmount * baseRates[riskType];
  }
}
