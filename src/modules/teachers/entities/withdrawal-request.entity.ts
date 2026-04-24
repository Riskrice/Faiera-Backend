import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { TeacherProfile } from './teacher-profile.entity';

export enum WithdrawalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('withdrawal_requests')
export class WithdrawalRequest extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  teacherId!: string;

  @ManyToOne(() => TeacherProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacherId', referencedColumnName: 'userId' })
  teacher!: TeacherProfile;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  status!: WithdrawalStatus;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Column({ type: 'text', nullable: true })
  adminNotes?: string;

  // Snapshot of payment details at the time of request (IBAN, Bank Name, etc.)
  @Column({ type: 'jsonb', nullable: true })
  paymentDetails?: Record<string, any>;
}
