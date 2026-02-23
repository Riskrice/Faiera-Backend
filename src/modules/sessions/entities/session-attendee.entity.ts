import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../database';
import { LiveSession } from './live-session.entity';

export enum AttendeeStatus {
    REGISTERED = 'registered',
    JOINED = 'joined',
    LEFT = 'left',
    ABSENT = 'absent',
    KICKED = 'kicked',
}

export enum AttendeeRole {
    HOST = 'host',
    CO_HOST = 'co_host',
    PARTICIPANT = 'participant',
}

@Entity('session_attendees')
@Unique(['sessionId', 'userId'])
export class SessionAttendee extends BaseEntity {
    @Index()
    @Column({ type: 'uuid' })
    sessionId!: string;

    @ManyToOne(() => LiveSession, session => session.attendees, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sessionId' })
    session!: LiveSession;

    @Index()
    @Column({ type: 'uuid' })
    userId!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    userName?: string;

    @Column({
        type: 'enum',
        enum: AttendeeRole,
        default: AttendeeRole.PARTICIPANT,
    })
    role!: AttendeeRole;

    @Column({
        type: 'enum',
        enum: AttendeeStatus,
        default: AttendeeStatus.REGISTERED,
    })
    status!: AttendeeStatus;

    // Join/Leave tracking
    @Column({ type: 'timestamptz', nullable: true })
    registeredAt?: Date;

    @Column({ type: 'timestamptz', nullable: true })
    joinedAt?: Date;

    @Column({ type: 'timestamptz', nullable: true })
    leftAt?: Date;

    // Attendance stats
    @Column({ type: 'int', default: 0 })
    totalAttendanceSeconds!: number;

    @Column({ type: 'int', default: 0 })
    joinCount!: number;

    // Join token (for secure entry)
    @Column({ type: 'varchar', length: 500, nullable: true })
    joinToken?: string;

    @Column({ type: 'timestamptz', nullable: true })
    tokenExpiresAt?: Date;

    // Engagement metrics
    @Column({ type: 'int', default: 0 })
    chatMessagesCount!: number;

    @Column({ type: 'int', default: 0 })
    questionsAsked!: number;

    @Column({ type: 'boolean', default: false })
    raisedHand!: boolean;

    // Payment (for paid sessions)
    @Column({ type: 'uuid', nullable: true })
    paymentId?: string;

    @Column({ type: 'boolean', default: false })
    hasPaid!: boolean;

    // Rating
    @Column({ type: 'int', nullable: true })
    rating?: number;

    @Column({ type: 'text', nullable: true })
    feedback?: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, unknown>;
}
