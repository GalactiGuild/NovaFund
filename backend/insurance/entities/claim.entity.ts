import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { ClaimStatus } from '../enums/claim-status.enum';

@Entity('claims')
export class Claim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  policyId: string;

  @Column('decimal')
  claimAmount: number;

  @Column({ type: 'enum', enum: ClaimStatus, default: ClaimStatus.PENDING })
  status: ClaimStatus;

  @Column('decimal', { nullable: true })
  payoutAmount?: number;

  @CreateDateColumn()
  createdAt: Date;
}
