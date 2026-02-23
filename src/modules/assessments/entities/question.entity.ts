import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../database';

export enum QuestionType {
    MCQ = 'mcq',                    // Multiple Choice (single answer)
    MCQ_MULTI = 'mcq_multi',        // Multiple Choice (multiple answers)
    TRUE_FALSE = 'true_false',      // True/False
    FILL_BLANK = 'fill_blank',      // Fill in the blank
    MATCHING = 'matching',          // Matching pairs
    ORDERING = 'ordering',          // Order/Sequence
    SHORT_ANSWER = 'short_answer',  // Short text answer
    ESSAY = 'essay',                // Long text (manual grading)
}

export enum DifficultyLevel {
    EASY = 'easy',
    MEDIUM = 'medium',
    HARD = 'hard',
    EXPERT = 'expert',
}

export enum QuestionStatus {
    DRAFT = 'draft',
    PENDING_REVIEW = 'pending_review',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    ARCHIVED = 'archived',
}

export enum CognitiveLevel {
    REMEMBER = 'remember',       // Bloom's Level 1
    UNDERSTAND = 'understand',   // Bloom's Level 2
    APPLY = 'apply',             // Bloom's Level 3
    ANALYZE = 'analyze',         // Bloom's Level 4
    EVALUATE = 'evaluate',       // Bloom's Level 5
    CREATE = 'create',           // Bloom's Level 6
}

export interface MCQOption {
    id: string;
    textAr: string;
    textEn: string;
    isCorrect: boolean;
    explanation?: string;
}

export interface MatchingPair {
    id: string;
    leftAr: string;
    leftEn: string;
    rightAr: string;
    rightEn: string;
}

export interface BlankAnswer {
    position: number;
    acceptedAnswers: string[];
    caseSensitive: boolean;
}

@Entity('questions')
export class Question extends BaseEntity {
    // Content
    @Column({ type: 'text' })
    questionAr!: string;

    @Column({ type: 'text' })
    questionEn!: string;

    @Column({ type: 'text', nullable: true })
    explanationAr?: string;

    @Column({ type: 'text', nullable: true })
    explanationEn?: string;

    // Classification
    @Index()
    @Column({
        type: 'enum',
        enum: QuestionType,
        default: QuestionType.MCQ,
    })
    type!: QuestionType;

    @Index()
    @Column({
        type: 'enum',
        enum: DifficultyLevel,
        default: DifficultyLevel.MEDIUM,
    })
    difficulty!: DifficultyLevel;

    @Column({
        type: 'enum',
        enum: CognitiveLevel,
        default: CognitiveLevel.UNDERSTAND,
    })
    cognitiveLevel!: CognitiveLevel;

    @Index()
    @Column({ type: 'varchar', length: 50 })
    grade!: string;

    @Index()
    @Column({ type: 'varchar', length: 100 })
    subject!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    topic?: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    subtopic?: string;

    @Column({ type: 'simple-array', nullable: true })
    tags?: string[];

    // Answer data (JSON structure depends on type)
    @Column({ type: 'jsonb' })
    answerData!: MCQOption[] | MatchingPair[] | BlankAnswer[] | Record<string, unknown>;

    // For ordering questions
    @Column({ type: 'jsonb', nullable: true })
    correctOrder?: string[];

    // For true/false
    @Column({ type: 'boolean', nullable: true })
    correctAnswer?: boolean;

    // Scoring
    @Column({ type: 'int', default: 1 })
    points!: number;

    @Column({ type: 'int', nullable: true })
    estimatedTimeSeconds?: number;

    @Column({ type: 'boolean', default: false })
    partialCredit!: boolean;

    // Media
    @Column({ type: 'varchar', length: 500, nullable: true })
    imageUrl?: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    audioUrl?: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    videoUrl?: string;

    // Status & Review
    @Index()
    @Column({
        type: 'enum',
        enum: QuestionStatus,
        default: QuestionStatus.DRAFT,
    })
    status!: QuestionStatus;

    @Index()
    @Column({ type: 'uuid' })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    reviewedBy?: string;

    @Column({ type: 'timestamptz', nullable: true })
    reviewedAt?: Date;

    @Column({ type: 'text', nullable: true })
    reviewNotes?: string;

    // Usage stats
    @Column({ type: 'int', default: 0 })
    usageCount!: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    correctRate!: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    avgTimeSeconds!: number;

    // Version & Audit
    @Column({ type: 'int', default: 1 })
    version!: number;

    @Column({ type: 'uuid', nullable: true })
    parentQuestionId?: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;

    // Helper method to check if manually graded
    requiresManualGrading(): boolean {
        return this.type === QuestionType.ESSAY || this.type === QuestionType.SHORT_ANSWER;
    }
}
