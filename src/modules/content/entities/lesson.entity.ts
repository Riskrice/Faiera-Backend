import { Entity, Column, ManyToOne, JoinColumn, Index, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../database';
import { Module } from './module.entity';
import { VideoResource } from './video-resource.entity';

export enum LessonType {
    VIDEO = 'video',
    ARTICLE = 'article',
    QUIZ = 'quiz',
    LIVE_SESSION = 'live_session',
}

export enum LessonStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
}

@Entity('lessons')
export class Lesson extends BaseEntity {
    @Column({ type: 'varchar', length: 255 })
    titleAr!: string;

    @Column({ type: 'varchar', length: 255 })
    titleEn!: string;

    @Column({ type: 'text', nullable: true })
    descriptionAr?: string;

    @Column({ type: 'text', nullable: true })
    descriptionEn?: string;

    @Index()
    @Column({ type: 'uuid' })
    moduleId!: string;

    @ManyToOne(() => Module, module => module.lessons, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'moduleId' })
    module!: Module;

    @Column({
        type: 'enum',
        enum: LessonType,
        default: LessonType.VIDEO,
    })
    type!: LessonType;

    @Column({
        type: 'enum',
        enum: LessonStatus,
        default: LessonStatus.DRAFT,
    })
    status!: LessonStatus;

    @Column({ type: 'int', default: 0 })
    sortOrder!: number;

    @Column({ type: 'int', default: 0 })
    durationMinutes!: number;

    // Video specific fields
    @Index()
    @Column({ type: 'uuid', nullable: true })
    videoResourceId?: string;

    @OneToOne(() => VideoResource, video => video.lesson, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'videoResourceId' })
    video?: VideoResource;

    @Column({ type: 'text', nullable: true })
    videoUrl?: string;

    // Article specific
    @Column({ type: 'text', nullable: true })
    contentAr?: string;

    @Column({ type: 'text', nullable: true })
    contentEn?: string;

    // Quiz specific
    @Column({ type: 'uuid', nullable: true })
    assessmentId?: string;

    // Version tracking
    @Column({ type: 'int', default: 1 })
    version!: number;

    @Column({ type: 'timestamptz', nullable: true })
    publishedAt?: Date;

    @Column({ type: 'boolean', default: false })
    isFree!: boolean;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;

    @Column({ type: 'jsonb', nullable: true })
    attachments?: { id: string; name: string; url: string; size?: string; type?: string }[];
}
