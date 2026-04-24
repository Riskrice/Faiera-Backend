import { Entity, Column, OneToMany, ManyToOne, JoinColumn, Index, AfterLoad } from 'typeorm';
import { BaseEntity } from '../../../database';
import { SessionAttendee } from './session-attendee.entity';
import { User } from '../../auth/entities/user.entity';

export enum SessionType {
  ONE_ON_ONE = 'one_on_one',
  GROUP = 'group',
  WEBINAR = 'webinar',
}

export enum SessionStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum RecurrenceType {
  NONE = 'none',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('live_sessions')
export class LiveSession extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  titleAr!: string;

  @Column({ type: 'varchar', length: 255 })
  titleEn!: string;

  @Column({ type: 'text', nullable: true })
  descriptionAr?: string;

  @Column({ type: 'text', nullable: true })
  descriptionEn?: string;

  @Column({
    type: 'enum',
    enum: SessionType,
    default: SessionType.GROUP,
  })
  type!: SessionType;

  @Index()
  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.SCHEDULED,
  })
  status!: SessionStatus;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  grade!: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  subject!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  topic?: string;

  // Linked content
  @Column({ type: 'uuid', nullable: true })
  lessonId?: string;

  @Column({ type: 'uuid', nullable: true })
  moduleId?: string;

  @Column({ type: 'uuid', nullable: true })
  courseId?: string;

  // Host (Teacher)
  @Index()
  @Column({ type: 'uuid' })
  hostId!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hostId' })
  teacher!: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  hostName?: string;

  // Scheduling
  @Index()
  @Column({ type: 'timestamptz' })
  scheduledStartTime!: Date;

  @Column({ type: 'timestamptz' })
  scheduledEndTime!: Date;

  @Column({ type: 'int', default: 60 })
  durationMinutes!: number;

  @Column({ type: 'timestamptz', nullable: true })
  actualStartTime?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  actualEndTime?: Date;

  // Recurrence
  @Column({
    type: 'enum',
    enum: RecurrenceType,
    default: RecurrenceType.NONE,
  })
  recurrence!: RecurrenceType;

  @Column({ type: 'uuid', nullable: true })
  parentSessionId?: string;

  // Capacity
  @Column({ type: 'int', default: 30 })
  maxParticipants!: number;

  @Column({ type: 'int', default: 0 })
  registeredCount!: number;

  @Column({ type: 'int', default: 0 })
  attendedCount!: number;

  // Jitsi Meet
  @Column({ type: 'varchar', length: 255 })
  jitsiRoomName!: string;

  @Column({ type: 'varchar', length: 100 })
  jitsiDomain!: string;

  // Recording
  @Column({ type: 'boolean', default: true })
  recordingEnabled!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  recordingUrl?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  recordingId?: string;

  @Column({ type: 'int', nullable: true })
  recordingDurationSeconds?: number;

  // Pricing (for private sessions)
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price?: number;

  @Column({ type: 'varchar', length: 3, default: 'EGP' })
  currency!: string;

  @Column({ type: 'boolean', default: false })
  isPaid!: boolean;

  // Notifications
  @Column({ type: 'boolean', default: true })
  notifyBefore24h!: boolean;

  @Column({ type: 'boolean', default: true })
  notifyBefore1h!: boolean;

  @Column({ type: 'boolean', default: true })
  notifyOnStart!: boolean;

  // Creator
  @Index()
  @Column({ type: 'uuid' })
  createdBy!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @OneToMany(() => SessionAttendee, attendee => attendee.session)
  attendees!: SessionAttendee[];

  // Computed properties (sent to frontend)
  canJoinNow?: boolean;
  minutesUntilJoin?: number;

  @AfterLoad()
  computeJoinability() {
    const now = new Date();
    const startBuffer = new Date(this.scheduledStartTime);
    startBuffer.setMinutes(startBuffer.getMinutes() - 10); // 10 min before

    if (this.status === SessionStatus.LIVE) {
      this.canJoinNow = true;
      this.minutesUntilJoin = 0;
    } else if (this.status === SessionStatus.SCHEDULED) {
      this.canJoinNow = now >= startBuffer;
      if (!this.canJoinNow) {
        this.minutesUntilJoin = Math.ceil((startBuffer.getTime() - now.getTime()) / 60000);
      } else {
        this.minutesUntilJoin = 0;
      }
    } else {
      this.canJoinNow = false;
      this.minutesUntilJoin = undefined;
    }
  }

  // Helper methods
  isLive(): boolean {
    return this.status === SessionStatus.LIVE;
  }

  canJoin(): boolean {
    if (this.status === SessionStatus.LIVE) return true;
    if (this.status !== SessionStatus.SCHEDULED) return false;

    const now = new Date();
    const startBuffer = new Date(this.scheduledStartTime);
    startBuffer.setMinutes(startBuffer.getMinutes() - 10); // 10 min before

    return now >= startBuffer;
  }
}
