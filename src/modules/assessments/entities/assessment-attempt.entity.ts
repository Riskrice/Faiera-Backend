import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { Assessment } from './assessment.entity';
import { AttemptAnswer } from './attempt-answer.entity';

export enum AttemptStatus {
    IN_PROGRESS = 'in_progress',
    PAUSED = 'paused',
    SUBMITTED = 'submitted',
    TIMED_OUT = 'timed_out',
    GRADED = 'graded',
    CANCELLED = 'cancelled',
}

@Entity('assessment_attempts')
export class AssessmentAttempt extends BaseEntity {
    @Index()
    @Column({ type: 'uuid' })
    assessmentId!: string;

    @ManyToOne(() => Assessment, assessment => assessment.attempts, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'assessmentId' })
    assessment!: Assessment;

    @Index()
    @Column({ type: 'uuid' })
    userId!: string;

    @Column({ type: 'int', default: 1 })
    attemptNumber!: number;

    @Column({
        type: 'enum',
        enum: AttemptStatus,
        default: AttemptStatus.IN_PROGRESS,
    })
    status!: AttemptStatus;

    @Column({ type: 'timestamptz' })
    startedAt!: Date;

    @Column({ type: 'timestamptz', nullable: true })
    submittedAt?: Date;

    @Column({ type: 'timestamptz', nullable: true })
    gradedAt?: Date;

    @Column({ type: 'int', default: 0 })
    timeSpentSeconds!: number;

    @Column({ type: 'timestamptz', nullable: true })
    lastActivityAt?: Date;

    @Column({ type: 'timestamptz', nullable: true })
    deadlineAt?: Date;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    rawScore?: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    percentageScore?: number;

    @Column({ type: 'int', nullable: true })
    earnedPoints?: number;

    @Column({ type: 'int', nullable: true })
    possiblePoints?: number;

    @Column({ type: 'boolean', nullable: true })
    passed?: boolean;

    @Column({ type: 'int', default: 0 })
    correctAnswers!: number;

    @Column({ type: 'int', default: 0 })
    incorrectAnswers!: number;

    @Column({ type: 'int', default: 0 })
    skippedQuestions!: number;

    @Column({ type: 'uuid', nullable: true })
    gradedBy?: string;

    @Column({ type: 'text', nullable: true })
    feedback?: string;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ipAddress?: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    userAgent?: string;

    @Column({ type: 'int', default: 0 })
    tabSwitchCount!: number;

    @Column({ type: 'jsonb', nullable: true })
    securityFlags?: Record<string, unknown>;

    @Column({ type: 'jsonb' })
    questionOrder!: string[];

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;

    @OneToMany(() => AttemptAnswer, answer => answer.attempt)
    answers!: AttemptAnswer[];
}
