import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../database';

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentType {
  SESSION_BOOKING = 'session_booking',
  SUBSCRIPTION = 'subscription',
  COURSE_ENROLLMENT = 'course_enrollment',
}

@Entity('transactions')
export class Transaction extends BaseEntity {
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 3, default: 'EGP' })
  currency!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status!: TransactionStatus;

  @Column({ type: 'varchar', length: 50, default: 'fawaterk' })
  provider!: string;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  providerTransactionId?: string; // Invoice ID from Fawaterk

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentMethod?: string; // e.g., 'VISA', 'Fawry'

  // User Relations
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userEmail?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userPhone?: string;

  // Purpose
  @Index()
  @Column({
    type: 'enum',
    enum: PaymentType,
  })
  type!: PaymentType;

  @Index()
  @Column({ type: 'uuid' })
  referenceId!: string; // Session ID or Plan ID

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  providerResponse?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 500, nullable: true })
  paymentLink?: string;
}
