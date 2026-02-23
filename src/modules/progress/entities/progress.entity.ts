import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    Unique,
} from 'typeorm';

export enum ContentType {
    LESSON = 'lesson',
    VIDEO = 'video',
    ASSESSMENT = 'assessment',
    COURSE = 'course',
}

@Entity('user_progress')
@Unique(['userId', 'contentType', 'contentId'])
@Index(['userId', 'contentType'])
export class UserProgress {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column('uuid')
    @Index()
    userId!: string;

    @Column({
        type: 'enum',
        enum: ContentType,
    })
    contentType!: ContentType;

    @Column('uuid')
    contentId!: string;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    progressPercent!: number;

    @Column({ type: 'int', default: 0 })
    lastPosition!: number; // For videos: seconds, for lessons: scroll position

    @Column({ type: 'int', default: 0 })
    totalDuration!: number; // Total duration in seconds (for videos)

    @Column({ type: 'int', default: 0 })
    timeSpent!: number; // Total time spent in seconds

    @Column({ type: 'timestamptz', nullable: true })
    startedAt!: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    completedAt!: Date | null;

    @Column({ type: 'jsonb', nullable: true })
    metadata!: Record<string, unknown> | null; // Additional data like quiz scores, etc.

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    // Helper methods
    isCompleted(): boolean {
        return this.progressPercent >= 100 || this.completedAt !== null;
    }

    markCompleted(): void {
        this.progressPercent = 100;
        this.completedAt = new Date();
    }
}

