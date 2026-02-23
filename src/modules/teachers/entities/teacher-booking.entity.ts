import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { TeacherProfile } from './teacher-profile.entity';
import { User } from '../../auth/entities/user.entity';

export enum BookingStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    CANCELLED = 'cancelled',
    COMPLETED = 'completed',
    NO_SHOW = 'no_show',
    RESCHEDULED = 'rescheduled',
}

export enum BookingType {
    ONE_ON_ONE = 'one_on_one',
    GROUP = 'group',
}

@Entity('teacher_bookings')
export class TeacherBooking extends BaseEntity {
    @Index()
    @Column({ type: 'uuid' })
    teacherId!: string;

    @ManyToOne(() => TeacherProfile, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'teacherId' })
    teacher!: TeacherProfile;

    @Index()
    @Column({ type: 'uuid' })
    studentId!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'studentId' })
    student!: User;

    @Column({ type: 'varchar', length: 255, nullable: true })
    studentName?: string;

    @Column({
        type: 'enum',
        enum: BookingType,
        default: BookingType.ONE_ON_ONE,
    })
    bookingType!: BookingType;

    @Index()
    @Column({
        type: 'enum',
        enum: BookingStatus,
        default: BookingStatus.PENDING,
    })
    status!: BookingStatus;

    // Scheduling
    @Index()
    @Column({ type: 'timestamptz' })
    scheduledStartTime!: Date;

    @Column({ type: 'timestamptz' })
    scheduledEndTime!: Date;

    @Column({ type: 'int' })
    durationMinutes!: number;

    // Subject/Topic
    @Column({ type: 'varchar', length: 100 })
    subject!: string;

    @Column({ type: 'varchar', length: 50 })
    grade!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    topic?: string;

    @Column({ type: 'text', nullable: true })
    notes?: string;

    // Session link
    @Column({ type: 'uuid', nullable: true })
    sessionId?: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    meetLink?: string;

    // Pricing
    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price!: number;

    @Column({ type: 'varchar', length: 3, default: 'EGP' })
    currency!: string;

    @Column({ type: 'boolean', default: false })
    isPaid!: boolean;

    @Column({ type: 'uuid', nullable: true })
    paymentId?: string;

    // Cancellation
    @Column({ type: 'timestamptz', nullable: true })
    cancelledAt?: Date;

    @Column({ type: 'text', nullable: true })
    cancellationReason?: string;

    @Column({ type: 'uuid', nullable: true })
    cancelledBy?: string;

    // Completion
    @Column({ type: 'timestamptz', nullable: true })
    completedAt?: Date;

    // Rescheduling
    @Column({ type: 'uuid', nullable: true })
    originalBookingId?: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;
}
