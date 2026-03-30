import { RoiResult } from './portfolio.types';

export class PortfolioRepository {
	async getUserROI(_userAddress: string): Promise<RoiResult> {
		// Placeholder implementation until portfolio data source is wired.
		return {
			totalInvested: 0,
			totalReturns: 0,
			totalYield: 0,
			roi: 0,
		};
	}
}
