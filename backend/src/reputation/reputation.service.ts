import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { calculateTrustScore } from './calculators/trust-score.calculator';

@Injectable()
export class ReputationService {
	constructor(private readonly prisma: PrismaService) {}

	async updateTrustScore(userId: string): Promise<number> {
		const score = await calculateTrustScore(this.prisma, userId);
		await this.prisma.user.update({
			where: { id: userId },
			data: { trustScore: score },
		});
		return score;
	}
}
