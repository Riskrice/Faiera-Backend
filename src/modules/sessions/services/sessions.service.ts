import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import { LiveSession, SessionStatus } from '../entities/live-session.entity';
import { SessionAttendee, AttendeeStatus, AttendeeRole } from '../entities/session-attendee.entity';
import { JitsiService } from './jitsi.service';
import { CreateSessionDto, UpdateSessionDto, SessionQueryDto, RateSessionDto } from '../dto';
import { PaginationQueryDto } from '../../../common/dto';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType, NotificationChannel, NotificationPriority } from '../../notifications/entities/notification.entity';
import { Role } from '../../auth/constants/roles.constant';

@Injectable()
export class SessionsService {
    private readonly logger = new Logger(SessionsService.name);

    constructor(
        @InjectRepository(LiveSession)
        private readonly sessionRepository: Repository<LiveSession>,
        @InjectRepository(SessionAttendee)
        private readonly attendeeRepository: Repository<SessionAttendee>,
        private readonly jitsiService: JitsiService,
        private readonly notificationsService: NotificationsService,
    ) { }

    async create(dto: CreateSessionDto, hostId: string): Promise<LiveSession> {
        // Calculate end time
        const scheduledEndTime = new Date(dto.scheduledStartTime);
        scheduledEndTime.setMinutes(scheduledEndTime.getMinutes() + dto.durationMinutes);

        // Generate Jitsi room name
        const jitsiRoomName = this.jitsiService.generateRoomName(hostId);

        const session = this.sessionRepository.create({
            ...dto,
            hostId,
            createdBy: hostId,
            scheduledEndTime,
            status: SessionStatus.SCHEDULED,
            jitsiRoomName,
            jitsiDomain: this.jitsiService.getDomain(),
        });

        await this.sessionRepository.save(session);

        // Add host as attendee
        await this.registerAttendee(session.id, hostId, AttendeeRole.HOST);

        // Schedule notification
        this.scheduleSessionReminder(session);

        this.logger.log(`Session created: ${session.titleEn} with Jitsi room: ${jitsiRoomName}`);
        return session;
    }

    async findAll(
        query: SessionQueryDto,
        pagination: PaginationQueryDto,
        userId?: string, // user.sub
    ): Promise<{ sessions: (LiveSession & { isRegistered?: boolean })[]; total: number }> {
        const where: FindOptionsWhere<LiveSession> = {};

        if (query.type) where.type = query.type;
        if (query.grade) where.grade = query.grade;
        if (query.subject) where.subject = query.subject;
        if (query.hostId) where.hostId = query.hostId;

        if (query.fromDate && query.toDate) {
            where.scheduledStartTime = Between(query.fromDate, query.toDate);
        } else if (query.fromDate) {
            where.scheduledStartTime = MoreThanOrEqual(query.fromDate);
        } else if (query.toDate) {
            where.scheduledStartTime = LessThanOrEqual(query.toDate);
        }

        const [sessions, total] = await this.sessionRepository.findAndCount({
            where,
            skip: pagination.skip,
            take: pagination.take,
            order: { scheduledStartTime: 'ASC' },
            relations: ['teacher'],
        });

        // If includeRegistration requested and we have a user
        if (query.includeRegistration && userId && sessions.length > 0) {
            const sessionIds = sessions.map(s => s.id);
            const registrations = await this.attendeeRepository
                .createQueryBuilder('attendee')
                .select('attendee.sessionId')
                .where('attendee.userId = :userId', { userId })
                .andWhere('attendee.sessionId IN (:...sessionIds)', { sessionIds })
                .getRawMany();

            const registeredSessionIds = new Set(registrations.map(r => r.attendee_sessionId));

            sessions.forEach(session => {
                (session as any).isRegistered = registeredSessionIds.has(session.id);
            });
        }

        return { sessions: sessions as (LiveSession & { isRegistered?: boolean })[], total };
    }

    async findById(id: string, userId?: string, userRole?: string): Promise<LiveSession> {
        const sessionBase = await this.sessionRepository.findOne({ where: { id } });

        if (!sessionBase) {
            throw new NotFoundException('Session not found');
        }

        const isHost = userId && sessionBase.hostId === userId;
        const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;

        if (isHost || isAdmin) {
            const session = await this.sessionRepository.findOne({
                where: { id },
                relations: ['attendees'],
            });
            return session!;
        }

        const session = await this.sessionRepository.createQueryBuilder('session')
            .leftJoinAndSelect('session.attendees', 'attendee', 'attendee.userId = :userId', { userId: userId || '00000000-0000-0000-0000-000000000000' })
            .where('session.id = :id', { id })
            .getOne();

        if (!session) {
            throw new NotFoundException('Session not found');
        }

        return session;
    }

    async findUpcoming(grade: string, subject: string, limit = 10): Promise<LiveSession[]> {
        return this.sessionRepository.find({
            where: {
                grade,
                subject,
                status: SessionStatus.SCHEDULED,
                scheduledStartTime: MoreThanOrEqual(new Date()),
            },
            order: { scheduledStartTime: 'ASC' },
            take: limit,
        });
    }

    async update(id: string, dto: UpdateSessionDto, userId: string): Promise<LiveSession> {
        const session = await this.findById(id);

        if (session.hostId !== userId) {
            throw new ForbiddenException('Only host can update session');
        }

        if (session.status !== SessionStatus.SCHEDULED) {
            throw new BadRequestException('Cannot update non-scheduled session');
        }

        // Update end time if duration changed
        if (dto.durationMinutes && dto.scheduledStartTime) {
            const endTime = new Date(dto.scheduledStartTime);
            endTime.setMinutes(endTime.getMinutes() + dto.durationMinutes);
            session.scheduledEndTime = endTime;
        } else if (dto.durationMinutes) {
            const endTime = new Date(session.scheduledStartTime);
            endTime.setMinutes(endTime.getMinutes() + dto.durationMinutes);
            session.scheduledEndTime = endTime;
        }

        Object.assign(session, dto);

        // Jitsi doesn't need external updates - room name stays the same

        await this.sessionRepository.save(session);
        this.logger.log(`Session updated: ${id}`);
        return session;
    }

    async cancel(id: string, userId: string): Promise<LiveSession> {
        const session = await this.findById(id);

        if (session.hostId !== userId) {
            throw new ForbiddenException('Only host can cancel session');
        }

        if (session.status === SessionStatus.LIVE) {
            throw new BadRequestException('Cannot cancel live session');
        }

        session.status = SessionStatus.CANCELLED;

        // Jitsi rooms don't need external cancellation

        await this.sessionRepository.save(session);

        // Notify registered attendees
        await this.notifySessionCancelled(session);

        this.logger.log(`Session cancelled: ${id}`);
        return session;
    }

    // ==================== Attendee Management ====================

    async registerAttendee(
        sessionId: string,
        userId: string,
        role: AttendeeRole = AttendeeRole.PARTICIPANT,
    ): Promise<SessionAttendee> {
        const session = await this.findById(sessionId);

        if (session.status !== SessionStatus.SCHEDULED) {
            throw new BadRequestException('Cannot register for non-scheduled session');
        }

        // Check if already registered
        const existing = await this.attendeeRepository.findOne({
            where: { sessionId, userId },
        });

        if (existing) {
            return existing;
        }

        // Atomic capacity check: increment only if under limit
        if (role !== AttendeeRole.HOST) {
            const result = await this.sessionRepository
                .createQueryBuilder()
                .update()
                .set({ registeredCount: () => '"registeredCount" + 1' })
                .where('id = :id AND "registeredCount" < "maxParticipants"', { id: sessionId })
                .execute();

            if (result.affected === 0) {
                throw new BadRequestException('Session is full');
            }
        } else {
            await this.sessionRepository.increment({ id: sessionId }, 'registeredCount', 1);
        }

        const attendee = this.attendeeRepository.create({
            sessionId,
            userId,
            role,
            status: AttendeeStatus.REGISTERED,
            registeredAt: new Date(),
        });

        await this.attendeeRepository.save(attendee);

        // Schedule reminder for the newly registered attendee
        if (role !== AttendeeRole.HOST) {
            this.scheduleAttendeeReminder(session, userId).catch(err =>
                this.logger.error(`Failed to schedule reminder for attendee ${userId}`, err),
            );
        }

        this.logger.log(`User ${userId} registered for session ${sessionId}`);
        return attendee;
    }

    async unregister(sessionId: string, userId: string): Promise<void> {
        const attendee = await this.attendeeRepository.findOne({
            where: { sessionId, userId },
        });

        if (!attendee) {
            throw new NotFoundException('Registration not found');
        }

        if (attendee.role === AttendeeRole.HOST) {
            throw new BadRequestException('Host cannot unregister');
        }

        await this.attendeeRepository.remove(attendee);

        // Atomic decrement to avoid race conditions
        await this.sessionRepository.decrement({ id: sessionId }, 'registeredCount', 1);
        // Ensure count never goes below 0
        await this.sessionRepository
            .createQueryBuilder()
            .update()
            .set({ registeredCount: 0 })
            .where('id = :id AND "registeredCount" < 0', { id: sessionId })
            .execute();

        this.logger.log(`User ${userId} unregistered from session ${sessionId}`);
    }

    async getJoinLink(sessionId: string, userId: string): Promise<{
        roomName: string;
        domain: string;
        joinToken: string;
        config: any;
    }> {
        const session = await this.findById(sessionId);

        // Verify user is registered
        const attendee = await this.attendeeRepository.findOne({
            where: { sessionId, userId },
        });

        if (!attendee) {
            throw new ForbiddenException('Not registered for this session');
        }

        if (!session.canJoin()) {
            throw new BadRequestException('Session is not available for joining');
        }

        // Generate join token
        const role = attendee.role === AttendeeRole.HOST ? 'host' : 'participant';
        const joinToken = this.jitsiService.generateJoinToken(sessionId, userId, role);

        // Update attendee with token
        attendee.joinToken = joinToken;
        attendee.tokenExpiresAt = new Date(Date.now() + 3600000); // 1 hour
        await this.attendeeRepository.save(attendee);

        // Get Jitsi room config
        const roomConfig = this.jitsiService.getRoomConfig({
            roomName: session.jitsiRoomName,
            displayName: attendee.userName || 'Student',
            isHost: attendee.role === AttendeeRole.HOST,
            sessionTitle: session.titleEn,
            domain: session.jitsiDomain,
        });

        return {
            roomName: session.jitsiRoomName,
            domain: session.jitsiDomain,
            joinToken,
            config: roomConfig,
        };
    }

    async recordJoin(sessionId: string, userId: string): Promise<void> {
        try {
            // Fetch minimal session data to check status
            const session = await this.sessionRepository.findOne({
                where: { id: sessionId },
                select: ['id', 'status', 'hostId']
            });

            if (!session) {
                throw new NotFoundException('Session not found');
            }

            const attendee = await this.attendeeRepository.findOne({
                where: { sessionId, userId },
            });

            if (!attendee) {
                throw new NotFoundException('Attendee not found');
            }

            // Update attendee status and stats (atomic increment for joinCount)
            await this.attendeeRepository.update(
                { sessionId, userId },
                {
                    status: AttendeeStatus.JOINED,
                    joinedAt: new Date(),
                }
            );
            await this.attendeeRepository.increment({ sessionId, userId }, 'joinCount', 1);

            // Update session if first join by host
            if (attendee.role === AttendeeRole.HOST && session.status === SessionStatus.SCHEDULED) {
                await this.sessionRepository.update(sessionId, {
                    status: SessionStatus.LIVE,
                    actualStartTime: new Date()
                });
                this.logger.log(`Session went live: ${sessionId}`);
            }

            // Update attended count atomically
            await this.sessionRepository
                .createQueryBuilder()
                .update()
                .set({
                    attendedCount: () => `(SELECT COUNT(*) FROM session_attendees WHERE "sessionId" = :sid AND status = 'joined')`,
                })
                .where('id = :sid', { sid: sessionId })
                .execute();

        } catch (error) {
            this.logger.error(`Failed to record join for session ${sessionId}, user ${userId}`, error);
            throw error;
        }
    }

    async recordLeave(sessionId: string, userId: string): Promise<void> {
        const attendee = await this.attendeeRepository.findOne({
            where: { sessionId, userId },
        });

        if (!attendee) return;

        attendee.status = AttendeeStatus.LEFT;
        attendee.leftAt = new Date();

        // Calculate attendance time
        if (attendee.joinedAt) {
            const attendanceTime = Math.floor(
                (new Date().getTime() - attendee.joinedAt.getTime()) / 1000,
            );
            attendee.totalAttendanceSeconds += attendanceTime;
        }

        await this.attendeeRepository.save(attendee);
    }

    async startSession(id: string, userId: string): Promise<LiveSession> {
        const session = await this.findById(id);

        if (session.hostId !== userId) {
            throw new ForbiddenException('Only host can start the session');
        }

        if (session.status === SessionStatus.LIVE) {
            return session;
        }

        if (session.status === SessionStatus.CANCELLED || session.status === SessionStatus.ENDED) {
            throw new BadRequestException('Cannot start cancelled or ended session');
        }

        session.status = SessionStatus.LIVE;
        session.actualStartTime = new Date();
        await this.sessionRepository.save(session);

        // Notify attendees
        await this.notifySessionStarted(session);

        this.logger.log(`Session started: ${id}`);
        return session;
    }

    async endSession(id: string, userId: string): Promise<LiveSession> {
        const session = await this.findById(id);

        if (session.hostId !== userId) {
            throw new ForbiddenException('Only host can end session');
        }

        return this.performEndSession(session);
    }

    private async performEndSession(session: LiveSession): Promise<LiveSession> {
        session.status = SessionStatus.ENDED;
        session.actualEndTime = new Date();

        await this.sessionRepository.save(session);

        // Mark all joined attendees as left
        await this.attendeeRepository.update(
            { sessionId: session.id, status: AttendeeStatus.JOINED },
            { status: AttendeeStatus.LEFT, leftAt: new Date() },
        );

        this.logger.log(`Session ended: ${session.id}`);
        return session;
    }

    async autoEndExpiredSessions(): Promise<number> {
        const now = new Date();
        const expiredSessions = await this.sessionRepository.find({
            where: {
                status: SessionStatus.LIVE,
                scheduledEndTime: LessThanOrEqual(new Date(now.getTime() - 30 * 60000)), // 30 mins grace
            },
        });

        for (const session of expiredSessions) {
            await this.performEndSession(session);
        }

        return expiredSessions.length;
    }

    async rateSession(sessionId: string, userId: string, dto: RateSessionDto): Promise<void> {
        const attendee = await this.attendeeRepository.findOne({
            where: { sessionId, userId },
        });

        if (!attendee) {
            throw new NotFoundException('Attendance record not found');
        }

        if (attendee.status !== AttendeeStatus.LEFT) {
            throw new BadRequestException('Can only rate after leaving session');
        }

        attendee.rating = dto.rating;
        attendee.feedback = dto.feedback;
        await this.attendeeRepository.save(attendee);

        this.logger.log(`User ${userId} rated session ${sessionId}: ${dto.rating}/5`);
    }

    /**
     * Regenerate Jitsi room name for a session
     * Useful when the room has lobby or other issues
     */
    async regenerateRoomName(sessionId: string, userId: string): Promise<{ roomName: string }> {
        const session = await this.findById(sessionId);

        // Only host or admin can regenerate room name
        if (session.hostId !== userId) {
            throw new ForbiddenException('Only host can regenerate room name');
        }

        // Don't allow regeneration for ended sessions
        if (session.status === SessionStatus.ENDED || session.status === SessionStatus.CANCELLED) {
            throw new BadRequestException('Cannot regenerate room for ended/cancelled session');
        }

        // Generate new room name
        const newRoomName = this.jitsiService.generateRoomName(sessionId);
        session.jitsiRoomName = newRoomName;
        await this.sessionRepository.save(session);

        this.logger.log(`Regenerated room name for session ${sessionId}: ${newRoomName}`);
        return { roomName: newRoomName };
    }

    async getUserSessions(userId: string, upcoming = true): Promise<LiveSession[]> {
        const attendeeRecords = await this.attendeeRepository.find({
            where: { userId },
            select: ['sessionId'],
        });

        const sessionIds = attendeeRecords.map(a => a.sessionId);
        if (sessionIds.length === 0) return [];

        const where: FindOptionsWhere<LiveSession> = {
            id: In(sessionIds),
        };

        if (upcoming) {
            where.scheduledStartTime = MoreThanOrEqual(new Date());
            where.status = SessionStatus.SCHEDULED;
        }

        return this.sessionRepository.find({
            where,
            order: { scheduledStartTime: upcoming ? 'ASC' : 'DESC' },
            take: 20,
        });
    }

    // ==================== NOTIFICATIONS ====================

    /**
     * Schedule reminder notification (10 minutes before session)
     */
    async scheduleSessionReminder(session: LiveSession): Promise<void> {
        const attendees = await this.attendeeRepository.find({
            where: { sessionId: session.id },
            select: ['userId'],
        });

        if (attendees.length === 0) return;

        const reminderTime = new Date(session.scheduledStartTime);
        reminderTime.setMinutes(reminderTime.getMinutes() - 10);

        // Don't schedule if already past
        if (reminderTime <= new Date()) return;

        for (const attendee of attendees) {
            try {
                await this.notificationsService.send({
                    userId: attendee.userId,
                    type: NotificationType.SESSION_REMINDER,
                    channel: NotificationChannel.IN_APP,
                    priority: NotificationPriority.HIGH,
                    titleAr: `⏰ تذكير: ${session.titleAr} تبدأ قريباً`,
                    titleEn: `⏰ Reminder: ${session.titleEn} starts soon`,
                    bodyAr: `الجلسة تبدأ بعد 10 دقائق. استعد للانضمام!`,
                    bodyEn: `Session starts in 10 minutes. Get ready to join!`,
                    actionUrl: `/student/sessions`,
                    entityType: 'session',
                    entityId: session.id,
                    scheduledAt: reminderTime,
                });
            } catch (error) {
                this.logger.error(`Failed to schedule reminder for user ${attendee.userId}`, error);
            }
        }

        this.logger.log(`Scheduled reminders for session ${session.id}`);
    }

    /**
     * Schedule a reminder for a single attendee who registered after session creation
     */
    private async scheduleAttendeeReminder(session: LiveSession, userId: string): Promise<void> {
        const reminderTime = new Date(session.scheduledStartTime);
        reminderTime.setMinutes(reminderTime.getMinutes() - 10);

        // Don't schedule if already past
        if (reminderTime <= new Date()) return;

        try {
            await this.notificationsService.send({
                userId,
                type: NotificationType.SESSION_REMINDER,
                channel: NotificationChannel.IN_APP,
                priority: NotificationPriority.HIGH,
                titleAr: `⏰ تذكير: ${session.titleAr} تبدأ قريباً`,
                titleEn: `⏰ Reminder: ${session.titleEn} starts soon`,
                bodyAr: `الجلسة تبدأ بعد 10 دقائق. استعد للانضمام!`,
                bodyEn: `Session starts in 10 minutes. Get ready to join!`,
                actionUrl: `/student/sessions`,
                entityType: 'session',
                entityId: session.id,
                scheduledAt: reminderTime,
            });
        } catch (error) {
            this.logger.error(`Failed to schedule reminder for attendee ${userId}`, error);
        }
    }

    /**
     * Send notification when session goes live
     */
    async notifySessionStarted(session: LiveSession): Promise<void> {
        const attendees = await this.attendeeRepository.find({
            where: { sessionId: session.id },
            select: ['userId'],
        });

        for (const attendee of attendees) {
            try {
                await this.notificationsService.send({
                    userId: attendee.userId,
                    type: NotificationType.SESSION_STARTED,
                    channel: NotificationChannel.IN_APP,
                    priority: NotificationPriority.URGENT,
                    titleAr: `🔴 الجلسة بدأت: ${session.titleAr}`,
                    titleEn: `🔴 Session Started: ${session.titleEn}`,
                    bodyAr: `الجلسة بدأت الآن! انضم فوراً.`,
                    bodyEn: `Session is live now! Join immediately.`,
                    actionUrl: `/student/sessions`,
                    entityType: 'session',
                    entityId: session.id,
                });
            } catch (error) {
                this.logger.error(`Failed to notify user ${attendee.userId} of session start`, error);
            }
        }

        this.logger.log(`Sent live notifications for session ${session.id}`);
    }

    /**
     * Send notification when session is cancelled
     */
    async notifySessionCancelled(session: LiveSession): Promise<void> {
        const attendees = await this.attendeeRepository.find({
            where: { sessionId: session.id },
            select: ['userId'],
        });

        for (const attendee of attendees) {
            try {
                await this.notificationsService.send({
                    userId: attendee.userId,
                    type: NotificationType.SESSION_CANCELLED,
                    channel: NotificationChannel.IN_APP,
                    priority: NotificationPriority.HIGH,
                    titleAr: `❌ تم إلغاء الجلسة: ${session.titleAr}`,
                    titleEn: `❌ Session Cancelled: ${session.titleEn}`,
                    bodyAr: `للأسف تم إلغاء هذه الجلسة. نعتذر عن أي إزعاج.`,
                    bodyEn: `Unfortunately this session has been cancelled. We apologize for any inconvenience.`,
                    entityType: 'session',
                    entityId: session.id,
                });
            } catch (error) {
                this.logger.error(`Failed to notify user ${attendee.userId} of cancellation`, error);
            }
        }

        this.logger.log(`Sent cancellation notifications for session ${session.id}`);
    }
}
