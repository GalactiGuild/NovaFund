import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Cached composite reputation score for a single user.
 *
 * One row per user, upserted after every recalculation. Storing the
 * factor breakdown alongside the composite score lets the frontend render
 * a transparent breakdown without re-running the algorithm.
 */
@Entity('reputation_scores')
@Index('IDX_rep_scores_subject', ['subjectId'], { unique: true })
@Index('IDX_rep_scores_composite', ['compositeScore'])
export class ReputationScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'subject_id' })
  subjectId: string;

  /** Final blended score in [0, 100]. */
  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'composite_score' })
  compositeScore: number;

  /** Contribution from success/failure rate factor (0–100). */
  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'success_rate_score' })
  successRateScore: number;

  /** Contribution from peer ratings factor (0–100). */
  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'peer_rating_score' })
  peerRatingScore: number;

  /** Contribution from contribution size/volume factor (0–100). */
  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'contribution_size_score' })
  contributionSizeScore: number;

  /** Contribution from community feedback (reviews + dispute outcomes) factor (0–100). */
  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'community_feedback_score' })
  communityFeedbackScore: number;

  /** Total number of activities used in the most recent calculation. */
  @Column({ type: 'integer', name: 'activity_count' })
  activityCount: number;

  /**
   * True when activityCount < MIN_ACTIVITY_THRESHOLD.
   * Frontend should show a "limited history" badge rather than treating
   * the score as fully reliable.
   */
  @Column({ type: 'boolean', name: 'low_confidence', default: false })
  lowConfidence: boolean;

  /** Timestamp of the most recent recalculation. */
  @UpdateDateColumn({ name: 'calculated_at', type: 'timestamptz' })
  calculatedAt: Date;
}