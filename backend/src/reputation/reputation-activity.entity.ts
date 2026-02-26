import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { ActivityType } from './reputation.constants';

/**
 * Immutable record of a single reputation-relevant event.
 *
 * Never updated after creation — acts as an append-only audit log.
 * The score is recomputed from this log on demand (or via scheduled job).
 */
@Entity('reputation_activities')
@Index('IDX_rep_activities_subject', ['subjectId'])
@Index('IDX_rep_activities_subject_type', ['subjectId', 'activityType'])
@Index('IDX_rep_activities_occurred', ['occurredAt'])
export class ReputationActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The user whose reputation is affected by this activity. */
  @Column({ type: 'uuid', name: 'subject_id' })
  subjectId: string;

  /** The user who triggered the activity (rater, counterparty, etc.). Nullable for system events. */
  @Column({ type: 'uuid', name: 'actor_id', nullable: true })
  actorId: string | null;

  @Column({
    type: 'enum',
    enum: ActivityType,
    name: 'activity_type',
  })
  activityType: ActivityType;

  /**
   * Numeric value whose meaning depends on activityType:
   * - PEER_RATING / COMMUNITY_REVIEW: raw rating (e.g. 1–5)
   * - SUCCESSFUL / FAILED TRANSACTION: transaction value in platform currency
   * - DISPUTE_WON / LOST, HIGH_VALUE_CONTRIBUTION: relative weight (default 1.0)
   */
  @Column({ type: 'decimal', precision: 18, scale: 4, name: 'value' })
  value: number;

  /**
   * Optional reference to the source entity (transactionId, reviewId, etc.)
   * for traceability without duplicating data here.
   */
  @Column({ type: 'uuid', name: 'reference_id', nullable: true })
  referenceId: string | null;

  /** When the underlying event happened (may differ from createdAt for backfills). */
  @Column({ type: 'timestamptz', name: 'occurred_at' })
  occurredAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
