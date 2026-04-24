import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../database';

export enum NotificationType {
  // Account
  WELCOME = 'welcome',
  VERIFY_EMAIL = 'verify_email',
  PASSWORD_RESET = 'password_reset',
  PASSWORD_CHANGED = 'password_changed',

  // Sessions
  SESSION_REMINDER = 'session_reminder',
  SESSION_STARTED = 'session_started',
  SESSION_CANCELLED = 'session_cancelled',
  SESSION_RESCHEDULED = 'session_rescheduled',

  // Bookings
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_CANCELLED = 'booking_cancelled',
  BOOKING_REMINDER = 'booking_reminder',

  // Assessments
  ASSESSMENT_AVAILABLE = 'assessment_available',
  ASSESSMENT_DEADLINE = 'assessment_deadline',
  ASSESSMENT_GRADED = 'assessment_graded',

  // Subscriptions
  SUBSCRIPTION_ACTIVATED = 'subscription_activated',
  SUBSCRIPTION_EXPIRING = 'subscription_expiring',
  SUBSCRIPTION_EXPIRED = 'subscription_expired',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',

  // Content
  NEW_CONTENT = 'new_content',
  COURSE_COMPLETED = 'course_completed',

  // Teachers
  TEACHER_APPROVED = 'teacher_approved',
  NEW_REVIEW = 'new_review',
  NEW_BOOKING = 'new_booking',

  // System
  MAINTENANCE = 'maintenance',
  ANNOUNCEMENT = 'announcement',
  CUSTOM = 'custom',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('notifications')
export class Notification extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type!: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.IN_APP,
  })
  channel!: NotificationChannel;

  @Index()
  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status!: NotificationStatus;

  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.NORMAL,
  })
  priority!: NotificationPriority;

  // Content
  @Column({ type: 'varchar', length: 255 })
  titleAr!: string;

  @Column({ type: 'varchar', length: 255 })
  titleEn!: string;

  @Column({ type: 'text' })
  bodyAr!: string;

  @Column({ type: 'text' })
  bodyEn!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl?: string;

  // Action
  @Column({ type: 'varchar', length: 255, nullable: true })
  actionUrl?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  actionType?: string;

  // Delivery
  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  readAt?: Date;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  // Related entity
  @Column({ type: 'varchar', length: 50, nullable: true })
  entityType?: string;

  @Column({ type: 'uuid', nullable: true })
  entityId?: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, unknown>;

  // Expiry
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;
}
