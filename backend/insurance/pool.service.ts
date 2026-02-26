import { Injectable } from '@nestjs/common';
import { InsurancePool } from './entities/insurance-pool.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class PoolService {
  constructor(@InjectRepository(InsurancePool) private readonly repo: Repository<InsurancePool>) {}

  async addCapital(poolId: string, amount: number) {
    const pool = await this.repo.findOne({ where: { id: poolId } });
    pool.capital += amount;
    return this.repo.save(pool);
  }

  async lockCapital(poolId: string, amount: number) {
    const pool = await this.repo.findOne({ where: { id: poolId } });
    pool.lockedCapital += amount;
    return this.repo.save(pool);
  }
}
