import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../database';
import { Course } from './course.entity';

export enum EnrollmentStatus {
    ACTIVE = 'active',
    COMPLETED = 'completed',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled',
}

export enum EnrollmentSource {
    PAYMENT = 'payment',
    SUBSCRIPTION = 'subscription',
    ADMIN_GRANT = 'admin_grant',
    FREE = 'free',
}

@Entity('enrollments')
@Unique(['userId', 'courseId'])
export class Enrollment extends BaseEntity {
    @Index()
    @Column({ type: 'uuid' })
    userId!: string;

    @Index()
    @Column({ type: 'uuid' })
    courseId!: string;

    @ManyToOne(() => Course, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'courseId' })
    course!: Course;

    @Column({
        type: 'enum',
        enum: EnrollmentStatus,
        default: EnrollmentStatus.ACTIVE,
    })
    status!: EnrollmentStatus;

    @Column({
        type: 'enum',
        enum: EnrollmentSource,
        default: EnrollmentSource.PAYMENT,
    })
    source!: EnrollmentSource;

    @Column({ type: 'uuid', nullable: true })
    transactionId?: string;

    @Column({ type: 'timestamptz', nullable: true })
    enrolledAt?: Date;

    @Column({ type: 'timestamptz', nullable: true })
    expiresAt?: Date;

    @Column({ type: 'timestamptz', nullable: true })
    completedAt?: Date;

    @Column({ type: 'int', default: 0 })
    progressPercent!: number;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;
}
