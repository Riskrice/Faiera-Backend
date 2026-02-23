import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { Subscription } from './subscription.entity';

export enum PlanType {
    MONTHLY = 'monthly',
    QUARTERLY = 'quarterly',
    SEMI_ANNUAL = 'semi_annual',
    ANNUAL = 'annual',
}

export enum PlanStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DEPRECATED = 'deprecated',
}

@Entity('subscription_plans')
export class SubscriptionPlan extends BaseEntity {
    @Column({ type: 'varchar', length: 255 })
    nameAr!: string;

    @Column({ type: 'varchar', length: 255 })
    nameEn!: string;

    @Column({ type: 'text', nullable: true })
    descriptionAr?: string;

    @Column({ type: 'text', nullable: true })
    descriptionEn?: string;

    @Index()
    @Column({ type: 'varchar', length: 50 })
    grade!: string;

    @Column({
        type: 'enum',
        enum: PlanType,
        default: PlanType.MONTHLY,
    })
    type!: PlanType;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    originalPrice?: number;

    @Column({ type: 'varchar', length: 3, default: 'EGP' })
    currency!: string;

    @Column({ type: 'int' })
    durationDays!: number;

    // Subjects included in this plan
    @Column({ type: 'jsonb', default: [] })
    subjects!: string[];

    // Features included
    @Column({ type: 'jsonb', default: [] })
    features!: string[];

    @Column({
        type: 'enum',
        enum: PlanStatus,
        default: PlanStatus.ACTIVE,
    })
    status!: PlanStatus;

    @Column({ type: 'int', default: 0 })
    sortOrder!: number;

    @Column({ type: 'boolean', default: false })
    isPopular!: boolean;

    @Column({ type: 'boolean', default: false })
    isFeatured!: boolean;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;

    @OneToMany(() => Subscription, subscription => subscription.plan)
    subscriptions!: Subscription[];
}
