import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { TeacherProfile } from './teacher-profile.entity';

export enum BillingCycle {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  TERM = 'term',
  YEARLY = 'yearly',
}

@Entity('subscription_packages')
export class SubscriptionPackage extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column({ type: 'varchar', length: 3, default: 'EGP' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: BillingCycle,
    default: BillingCycle.MONTHLY,
  })
  billingCycle!: BillingCycle;

  @Column({ type: 'varchar', length: 100 })
  educationalStage!: string; // e.g., "Primary", "Grade 10", "Thanaweya Amma"

  @Column({ type: 'simple-array', nullable: true })
  features!: string[]; // List of benefits e.g., "8 Sessions", "Exam Reviews"

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Index()
  @Column({ type: 'uuid' })
  teacherId!: string;

  @ManyToOne(() => TeacherProfile, teacher => teacher.packages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacherId' })
  teacher!: TeacherProfile;
}
