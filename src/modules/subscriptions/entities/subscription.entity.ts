import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { SubscriptionPlan } from './subscription-plan.entity';
import { User } from '../../auth/entities/user.entity';

export enum SubscriptionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
}

@Entity('subscriptions')
export class Subscription extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index()
  @Column({ type: 'uuid' })
  planId!: string;

  @ManyToOne(() => SubscriptionPlan, plan => plan.subscriptions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'planId' })
  plan!: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.PENDING,
  })
  status!: SubscriptionStatus;

  @Column({ type: 'timestamptz' })
  startDate!: Date;

  @Column({ type: 'timestamptz' })
  endDate!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  paidAmount!: number;

  @Column({ type: 'varchar', length: 3, default: 'EGP' })
  currency!: string;

  @Column({ type: 'uuid', nullable: true })
  paymentId?: string;

  // Cached subjects from plan at time of purchase
  @Column({ type: 'jsonb', default: [] })
  subjects!: string[];

  // Cached grade from plan
  @Column({ type: 'varchar', length: 50 })
  grade!: string;

  @Column({ type: 'boolean', default: false })
  autoRenew!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cancellationReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  // Helper methods
  isActive(): boolean {
    const now = new Date();
    return (
      this.status === SubscriptionStatus.ACTIVE && now >= this.startDate && now <= this.endDate
    );
  }

  isExpired(): boolean {
    return new Date() > this.endDate;
  }

  hasSubject(subject: string): boolean {
    return this.subjects.includes(subject);
  }

  daysRemaining(): number {
    if (this.isExpired()) return 0;
    const now = new Date();
    const diff = this.endDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}
