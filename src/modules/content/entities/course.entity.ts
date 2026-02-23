import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { Program } from './program.entity';
import { Module } from './module.entity';

export enum CourseStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
}

@Entity('courses')
export class Course extends BaseEntity {
    @Column({ type: 'varchar', length: 255 })
    titleAr!: string;

    @Column({ type: 'varchar', length: 255 })
    titleEn!: string;

    @Column({ type: 'text', nullable: true })
    descriptionAr?: string;

    @Column({ type: 'text', nullable: true })
    descriptionEn?: string;

    @Index()
    @Column({ type: 'uuid', nullable: true })
    programId!: string | null;

    @ManyToOne(() => Program, program => program.courses, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'programId' })
    program?: Program;

    @Column({ type: 'varchar', length: 255, nullable: true })
    subject?: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    grade?: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    term?: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    thumbnailUrl?: string;

    @Column({
        type: 'enum',
        enum: CourseStatus,
        default: CourseStatus.PUBLISHED,
    })
    status!: CourseStatus;

    @Column({ type: 'int', default: 0 })
    sortOrder!: number;

    @Column({ type: 'int', default: 0 })
    totalDurationMinutes!: number;

    @Column({ type: 'int', default: 0 })
    lessonCount!: number;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    price!: number;

    @Column({ type: 'varchar', length: 10, default: 'EGP' })
    currency!: string;

    @OneToMany(() => Module, module => module.course)
    modules!: Module[];

    @Column({ type: 'uuid', nullable: true })
    @Index()
    teacherId?: string;

    @ManyToOne('TeacherProfile', 'courses', { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'teacherId' })
    teacher?: any; // Using any or string to avoid circular dependency if TeacherProfile isn't imported, but string reference works in TypeORM

    @Column({ type: 'uuid', nullable: true })
    @Index()
    createdBy?: string;
}
