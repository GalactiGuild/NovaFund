import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('reinsurance_contracts')
export class ReinsuranceContract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  poolId: string;

  @Column('decimal')
  coverageLimit: number;

  @Column('decimal')
  premiumRate: number;

  @CreateDateColumn()
  createdAt: Date;
}
