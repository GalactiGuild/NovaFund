import { Injectable } from '@nestjs/common';
import { Claim } from './entities/claim.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ClaimStatus } from './enums/claim-status.enum';

@Injectable()
export class ClaimService {
  constructor(@InjectRepository(Claim) private readonly repo: Repository<Claim>) {}

  async assessClaim(claimId: string): Promise<Claim> {
    const claim = await this.repo.findOne({ where: { id: claimId } });
    // Simplified automated assessment
    claim.status = ClaimStatus.APPROVED;
    claim.payoutAmount = claim.claimAmount;
    return this.repo.save(claim);
  }

  async payClaim(claimId: string): Promise<Claim> {
    const claim = await this.repo.findOne({ where: { id: claimId } });
    claim.status = ClaimStatus.PAID;
    return this.repo.save(claim);
  }
}
