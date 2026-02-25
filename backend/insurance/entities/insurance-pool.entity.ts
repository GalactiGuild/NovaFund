import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('insurance_pools')
export class InsurancePool {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('decimal')
  capital: number;

  @Column('decimal')
  lockedCapital: number;

  @CreateDateColumn()
  createdAt: Date;
}
