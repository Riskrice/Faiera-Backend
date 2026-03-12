import { Entity, Column, Index, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database';
import { SubscriptionPackage } from './subscription-package.entity';
import { User } from '../../auth/entities/user.entity';

export enum TeacherStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    SUSPENDED = 'suspended',
    INACTIVE = 'inactive',
}

export enum TeachingLevel {
    BEGINNER = 'beginner',
    INTERMEDIATE = 'intermediate',
    ADVANCED = 'advanced',
    EXPERT = 'expert',
}

@Entity('teacher_profiles')
export class TeacherProfile extends BaseEntity {
    @Index({ unique: true })
    @Column({ type: 'uuid' })
    userId!: string;

    @OneToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    // Professional info
    @Column({ type: 'varchar', length: 500 })
    bioAr!: string;

    @Column({ type: 'varchar', length: 500 })
    bioEn!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    headline?: string;

    @Column({ type: 'simple-array' })
    subjects!: string[];

    @Column({ type: 'simple-array' })
    grades!: string[];

    @Column({
        type: 'enum',
        enum: TeachingLevel,
        default: TeachingLevel.INTERMEDIATE,
    })
    teachingLevel!: TeachingLevel;

    @Column({ type: 'int', default: 0 })
    yearsOfExperience!: number;

    // Qualifications
    @Column({ type: 'jsonb', nullable: true })
    qualifications?: Array<{
        degree: string;
        institution: string;
        year: number;
    }>;

    @Column({ type: 'jsonb', nullable: true })
    certifications?: Array<{
        name: string;
        issuer: string;
        year: number;
        expiryYear?: number;
    }>;

    // Status
    @Index()
    @Column({
        type: 'enum',
        enum: TeacherStatus,
        default: TeacherStatus.PENDING,
    })
    status!: TeacherStatus;

    @Column({ type: 'timestamptz', nullable: true })
    approvedAt?: Date;

    @Column({ type: 'uuid', nullable: true })
    approvedBy?: string;

    // Pricing
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 100 })
    hourlyRate!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    groupSessionRate?: number;

    @Column({ type: 'varchar', length: 3, default: 'EGP' })
    currency!: string;

    // Session settings
    @Column({ type: 'int', default: 60 })
    defaultSessionDuration!: number;

    @Column({ type: 'int', default: 10 })
    maxStudentsPerGroup!: number;

    @Column({ type: 'boolean', default: true })
    offersOneOnOne!: boolean;

    @Column({ type: 'boolean', default: true })
    offersGroupSessions!: boolean;

    @Column({ type: 'boolean', default: false })
    offersHomeVisits!: boolean;

    // Ratings
    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
    averageRating!: number;

    @Column({ type: 'int', default: 0 })
    totalRatings!: number;

    @Column({ type: 'int', default: 0 })
    totalSessions!: number;

    @Column({ type: 'int', default: 0 })
    totalStudents!: number;

    // Availability
    @Column({ type: 'boolean', default: true })
    isAvailable!: boolean;

    // Financials
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    currentBalance!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    frozenBalance!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    totalEarnings!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    totalWithdrawn!: number;

    @Column({ type: 'varchar', length: 50, default: 'Africa/Cairo' })
    timezone!: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;

    @OneToMany(() => SubscriptionPackage, (pkg) => pkg.teacher)
    packages!: SubscriptionPackage[];
}
