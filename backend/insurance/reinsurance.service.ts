import { Injectable } from '@nestjs/common';
import { ReinsuranceContract } from './entities/reinsurance-contract.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class ReinsuranceService {
  constructor(@InjectRepository(ReinsuranceContract) private readonly repo: Repository<ReinsuranceContract>) {}

  async createContract(poolId: string, coverageLimit: number, premiumRate: number) {
    const contract = this.repo.create({ poolId, coverageLimit, premiumRate });
    return this.repo.save(contract);
  }
}
