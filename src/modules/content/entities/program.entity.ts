import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { Course } from './course.entity';

export enum ProgramStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
}

@Entity('programs')
export class Program extends BaseEntity {
    @Column({ type: 'varchar', length: 255 })
    titleAr!: string;

    @Column({ type: 'varchar', length: 255 })
    titleEn!: string;

    @Column({ type: 'text', nullable: true })
    descriptionAr?: string;

    @Column({ type: 'text', nullable: true })
    descriptionEn?: string;

    @Index()
    @Column({ type: 'varchar', length: 50 })
    grade!: string;

    @Index()
    @Column({ type: 'varchar', length: 100 })
    subject!: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    thumbnailUrl?: string;

    @Column({
        type: 'enum',
        enum: ProgramStatus,
        default: ProgramStatus.DRAFT,
    })
    status!: ProgramStatus;

    @Column({ type: 'int', default: 0 })
    sortOrder!: number;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;

    @OneToMany(() => Course, course => course.program)
    courses!: Course[];
}
