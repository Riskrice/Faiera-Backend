import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { AssessmentAttempt } from './assessment-attempt.entity';
import { Question } from './question.entity';

@Entity('attempt_answers')
export class AttemptAnswer extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  attemptId!: string;

  @ManyToOne(() => AssessmentAttempt, attempt => attempt.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attemptId' })
  attempt!: AssessmentAttempt;

  @Index()
  @Column({ type: 'uuid' })
  questionId!: string;

  @ManyToOne(() => Question, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question!: Question;

  @Column({ type: 'int' })
  questionOrder!: number;

  // Answer data (format depends on question type)
  @Column({ type: 'jsonb', nullable: true })
  answerData?: Record<string, unknown>;

  // For MCQ
  @Column({ type: 'simple-array', nullable: true })
  selectedOptions?: string[];

  // For text answers
  @Column({ type: 'text', nullable: true })
  textAnswer?: string;

  // For ordering
  @Column({ type: 'jsonb', nullable: true })
  orderedItems?: string[];

  // For matching
  @Column({ type: 'jsonb', nullable: true })
  matchedPairs?: Record<string, string>;

  // Grading
  @Column({ type: 'boolean', nullable: true })
  isCorrect?: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  partialScore!: number;

  @Column({ type: 'int', default: 0 })
  earnedPoints!: number;

  @Column({ type: 'text', nullable: true })
  feedback?: string;

  // Manual grading
  @Column({ type: 'boolean', default: false })
  requiresManualGrading!: boolean;

  @Column({ type: 'uuid', nullable: true })
  gradedBy?: string;

  @Column({ type: 'timestamptz', nullable: true })
  gradedAt?: Date;

  // Timing
  @Column({ type: 'int', default: 0 })
  timeSpentSeconds!: number;

  @Column({ type: 'timestamptz', nullable: true })
  answeredAt?: Date;

  // Flags
  @Column({ type: 'boolean', default: false })
  flaggedForReview!: boolean;

  @Column({ type: 'boolean', default: false })
  skipped!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
