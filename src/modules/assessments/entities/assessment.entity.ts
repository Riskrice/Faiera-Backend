import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { AssessmentQuestion } from './assessment-question.entity';
import { AssessmentAttempt } from './assessment-attempt.entity';

export enum AssessmentType {
  QUIZ = 'quiz',
  EXAM = 'exam',
  HOMEWORK = 'homework',
  PRACTICE = 'practice',
  DIAGNOSTIC = 'diagnostic',
}

export enum AssessmentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

export enum ShuffleMode {
  NONE = 'none',
  QUESTIONS = 'questions',
  OPTIONS = 'options',
  BOTH = 'both',
}

@Entity('assessments')
export class Assessment extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  titleAr!: string;

  @Column({ type: 'varchar', length: 255 })
  titleEn!: string;

  @Column({ type: 'text', nullable: true })
  descriptionAr?: string;

  @Column({ type: 'text', nullable: true })
  descriptionEn?: string;

  @Column({ type: 'text', nullable: true })
  instructionsAr?: string;

  @Column({ type: 'text', nullable: true })
  instructionsEn?: string;

  @Column({
    type: 'enum',
    enum: AssessmentType,
    default: AssessmentType.QUIZ,
  })
  type!: AssessmentType;

  @Index()
  @Column({
    type: 'enum',
    enum: AssessmentStatus,
    default: AssessmentStatus.DRAFT,
  })
  status!: AssessmentStatus;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  grade!: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  subject!: string;

  @Column({ type: 'uuid', nullable: true })
  lessonId?: string;

  @Column({ type: 'uuid', nullable: true })
  moduleId?: string;

  @Column({ type: 'uuid', nullable: true })
  courseId?: string;

  // Timing
  @Column({ type: 'int', nullable: true })
  timeLimitMinutes?: number;

  @Column({ type: 'timestamptz', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endDate?: Date;

  // Attempts
  @Column({ type: 'int', default: 1 })
  maxAttempts!: number;

  @Column({ type: 'boolean', default: false })
  allowRetake!: boolean;

  @Column({ type: 'int', nullable: true })
  retakeCooldownHours?: number;

  // Scoring
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  passingScore!: number;

  @Column({ type: 'int', default: 0 })
  totalPoints!: number;

  @Column({ type: 'boolean', default: false })
  showScoreImmediately!: boolean;

  @Column({ type: 'boolean', default: false })
  showCorrectAnswers!: boolean;

  @Column({ type: 'boolean', default: true })
  showExplanations!: boolean;

  // Randomization
  @Column({
    type: 'enum',
    enum: ShuffleMode,
    default: ShuffleMode.BOTH,
  })
  shuffleMode!: ShuffleMode;

  @Column({ type: 'int', nullable: true })
  questionPoolSize?: number;

  // Security
  @Column({ type: 'boolean', default: false })
  requireProctoring!: boolean;

  @Column({ type: 'boolean', default: false })
  preventCopyPaste!: boolean;

  @Column({ type: 'boolean', default: false })
  lockBrowser!: boolean;

  // Creator
  @Index()
  @Column({ type: 'uuid' })
  createdBy!: string;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @OneToMany(() => AssessmentQuestion, aq => aq.assessment)
  assessmentQuestions!: AssessmentQuestion[];

  @OneToMany(() => AssessmentAttempt, attempt => attempt.assessment)
  attempts!: AssessmentAttempt[];
}
