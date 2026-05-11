import { Entity, Column, Index, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../database';
import { PromoCode } from './promo-code.entity';
import { User } from '../../auth/entities/user.entity';

export enum RedemptionStatus {
  COMPLETED = 'completed',
  REVERSED = 'reversed',
}

@Entity('promo_code_redemptions')
@Unique(['promoCodeId', 'userId', 'transactionId'])
export class PromoCodeRedemption extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  promoCodeId!: string;

  @ManyToOne(() => PromoCode, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'promoCodeId' })
  promoCode!: PromoCode;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  transactionId?: string;

  @Column({ type: 'uuid', nullable: true })
  courseId?: string;

  @Column({ type: 'uuid', nullable: true })
  planId?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  originalAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  finalAmount!: number;

  @Column({ type: 'timestamptz' })
  redeemedAt!: Date;

  @Column({
    type: 'enum',
    enum: RedemptionStatus,
    default: RedemptionStatus.COMPLETED,
  })
  status!: RedemptionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  reversedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
