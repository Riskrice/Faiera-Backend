import { Entity, Column, Index, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../database';
import { PromoCode } from './promo-code.entity';
import { User } from '../../auth/entities/user.entity';

export enum RedemptionStatus {
  RESERVED = 'reserved',
  COMPLETED = 'completed',
  REVERSED = 'reversed',
  EXPIRED = 'expired',
}

@Entity('promo_code_redemptions')
@Unique(['promoCodeId', 'userId', 'transactionId'])
@Index('IDX_promo_code_redemptions_transaction_unique', ['transactionId'], {
  unique: true,
  where: '"transactionId" IS NOT NULL',
})
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
  transactionId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  courseId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  planId?: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  originalAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  finalAmount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  reservedAt?: Date | null;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  reservationExpiresAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  redeemedAt?: Date | null;

  @Column({
    type: 'enum',
    enum: RedemptionStatus,
    default: RedemptionStatus.COMPLETED,
  })
  status!: RedemptionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  reversedAt?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;
}
