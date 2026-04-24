import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../database';

@Entity('notification_preferences')
export class NotificationPreference extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  userId!: string;

  // Channel preferences
  @Column({ type: 'boolean', default: true })
  inAppEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  pushEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  emailEnabled!: boolean;

  @Column({ type: 'boolean', default: false })
  smsEnabled!: boolean;

  @Column({ type: 'boolean', default: false })
  whatsappEnabled!: boolean;

  // Type preferences
  @Column({ type: 'boolean', default: true })
  sessionReminders!: boolean;

  @Column({ type: 'boolean', default: true })
  bookingUpdates!: boolean;

  @Column({ type: 'boolean', default: true })
  assessmentAlerts!: boolean;

  @Column({ type: 'boolean', default: true })
  subscriptionAlerts!: boolean;

  @Column({ type: 'boolean', default: true })
  newContent!: boolean;

  @Column({ type: 'boolean', default: true })
  marketing!: boolean;

  // Quiet hours
  @Column({ type: 'boolean', default: false })
  quietHoursEnabled!: boolean;

  @Column({ type: 'time', nullable: true })
  quietHoursStart?: string;

  @Column({ type: 'time', nullable: true })
  quietHoursEnd?: string;

  @Column({ type: 'varchar', length: 50, default: 'Africa/Cairo' })
  timezone!: string;

  @Column({ type: 'varchar', length: 10, default: 'ar' })
  preferredLanguage!: string;
}
