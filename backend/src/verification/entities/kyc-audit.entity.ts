import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('kyc_audit_logs')
export class KycAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  previousStatus: string;

  @Column()
  newStatus: string;

  @Column()
  action: 'APPROVE' | 'REJECT' | 'OVERRIDE';

  @Column()
  adminId: string;

  @Column({ nullable: true })
  reason?: string;

  @CreateDateColumn()
  createdAt: Date;
}