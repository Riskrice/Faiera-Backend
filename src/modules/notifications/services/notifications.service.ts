import {
    Injectable,
    NotFoundException,
    Logger,
    Inject,
    forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository, FindOptionsWhere, MoreThanOrEqual, LessThanOrEqual, IsNull } from 'typeorm';
import {
    Notification,
    NotificationChannel,
    NotificationStatus,
    NotificationPriority,
} from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';
import {
    SendNotificationDto,
    SendBulkNotificationDto,
    SendTemplateNotificationDto,
    UpdatePreferencesDto,
    NotificationQueryDto,
} from '../dto';
import { PaginationQueryDto } from '../../../common/dto';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import { QUEUE_NAMES } from '../../../queue/constants';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepository: Repository<Notification>,
        @InjectRepository(NotificationPreference)
        private readonly preferenceRepository: Repository<NotificationPreference>,
        @InjectRepository(NotificationTemplate)
        private readonly templateRepository: Repository<NotificationTemplate>,
        @Inject(forwardRef(() => NotificationsGateway))
        private readonly notificationsGateway: NotificationsGateway,
        @InjectQueue(QUEUE_NAMES.EMAILS)
        private readonly emailQueue: Queue,
    ) { }

    // ==================== Send Notifications ====================

    async send(dto: SendNotificationDto): Promise<Notification> {
        const notification = this.notificationRepository.create({
            ...dto,
            channel: dto.channel || NotificationChannel.IN_APP,
            priority: dto.priority || NotificationPriority.NORMAL,
            status: dto.scheduledAt ? NotificationStatus.PENDING : NotificationStatus.SENT,
            sentAt: dto.scheduledAt ? undefined : new Date(),
        });

        await this.notificationRepository.save(notification);

        // If not scheduled, dispatch immediately
        if (!dto.scheduledAt) {
            await this.dispatch(notification);
            // Emit real-time notification via WebSocket
            this.notificationsGateway.sendToUser(dto.userId, notification);
        }

        this.logger.log(`Notification sent: ${notification.id} to ${dto.userId}`);
        return notification;
    }

    async sendBulk(dto: SendBulkNotificationDto): Promise<number> {
        const notifications = dto.userIds.map(userId =>
            this.notificationRepository.create({
                userId,
                type: dto.type,
                channel: NotificationChannel.IN_APP,
                priority: NotificationPriority.NORMAL,
                titleAr: dto.titleAr,
                titleEn: dto.titleEn,
                bodyAr: dto.bodyAr,
                bodyEn: dto.bodyEn,
                actionUrl: dto.actionUrl,
                status: dto.scheduledAt ? NotificationStatus.PENDING : NotificationStatus.SENT,
                sentAt: dto.scheduledAt ? undefined : new Date(),
                scheduledAt: dto.scheduledAt,
            }),
        );

        await this.notificationRepository.save(notifications);

        this.logger.log(`Bulk notification sent to ${dto.userIds.length} users`);
        return notifications.length;
    }

    async sendFromTemplate(dto: SendTemplateNotificationDto): Promise<Notification> {
        const template = await this.templateRepository.findOne({
            where: { code: dto.templateCode, isActive: true },
        });

        if (!template) {
            throw new NotFoundException(`Template not found: ${dto.templateCode}`);
        }

        // Replace variables in template
        let titleAr = template.titleAr;
        let titleEn = template.titleEn;
        let bodyAr = template.bodyAr;
        let bodyEn = template.bodyEn;

        if (dto.variables) {
            for (const [key, value] of Object.entries(dto.variables)) {
                const placeholder = `{{${key}}}`;
                titleAr = titleAr.split(placeholder).join(value);
                titleEn = titleEn.split(placeholder).join(value);
                bodyAr = bodyAr.split(placeholder).join(value);
                bodyEn = bodyEn.split(placeholder).join(value);
            }
        }

        return this.send({
            userId: dto.userId,
            type: template.type,
            channel: dto.channel || NotificationChannel.IN_APP,
            titleAr,
            titleEn,
            bodyAr,
            bodyEn,
            actionUrl: dto.actionUrl,
            entityType: dto.entityType,
            entityId: dto.entityId,
        });
    }

    // ==================== Query Notifications ====================

    async getUserNotifications(
        userId: string,
        query: NotificationQueryDto,
        pagination: PaginationQueryDto,
    ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
        const where: FindOptionsWhere<Notification> = {
            userId,
            channel: NotificationChannel.IN_APP,
        };

        if (query.type) where.type = query.type;
        if (query.unreadOnly) where.readAt = IsNull();
        if (query.fromDate) where.createdAt = MoreThanOrEqual(query.fromDate);

        const [notifications, total] = await this.notificationRepository.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: pagination.skip,
            take: pagination.take,
        });

        const unreadCount = await this.notificationRepository.count({
            where: { userId, readAt: IsNull(), channel: NotificationChannel.IN_APP },
        });

        return { notifications, total, unreadCount };
    }

    async getUnreadCount(userId: string): Promise<number> {
        return this.notificationRepository.count({
            where: { userId, readAt: IsNull(), channel: NotificationChannel.IN_APP },
        });
    }

    async markAsRead(notificationId: string, userId: string): Promise<Notification> {
        const notification = await this.notificationRepository.findOne({
            where: { id: notificationId, userId },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        notification.status = NotificationStatus.READ;
        notification.readAt = new Date();
        await this.notificationRepository.save(notification);

        return notification;
    }

    async markAllAsRead(userId: string): Promise<number> {
        const result = await this.notificationRepository.update(
            { userId, readAt: IsNull() },
            { readAt: new Date(), status: NotificationStatus.READ },
        );

        // Update unread count via WebSocket
        this.notificationsGateway.updateUnreadCount(userId, 0);

        return result.affected || 0;
    }

    async deleteNotification(notificationId: string, userId: string): Promise<void> {
        const result = await this.notificationRepository.delete({
            id: notificationId,
            userId,
        });

        if (result.affected === 0) {
            throw new NotFoundException('Notification not found');
        }
    }

    // ==================== Preferences ====================

    async getPreferences(userId: string): Promise<NotificationPreference> {
        let preferences = await this.preferenceRepository.findOne({ where: { userId } });

        if (!preferences) {
            preferences = this.preferenceRepository.create({ userId });
            await this.preferenceRepository.save(preferences);
        }

        return preferences;
    }

    async updatePreferences(
        userId: string,
        dto: UpdatePreferencesDto,
    ): Promise<NotificationPreference> {
        let preferences = await this.preferenceRepository.findOne({ where: { userId } });

        if (!preferences) {
            preferences = this.preferenceRepository.create({ userId });
        }

        Object.assign(preferences, dto);
        await this.preferenceRepository.save(preferences);

        return preferences;
    }

    // ==================== Dispatch ====================

    private async dispatch(notification: Notification): Promise<void> {
        try {
            switch (notification.channel) {
                case NotificationChannel.IN_APP:
                    // Already saved, just update status
                    break;

                case NotificationChannel.PUSH:
                    await this.sendPush(notification);
                    break;

                case NotificationChannel.EMAIL:
                    await this.sendEmail(notification);
                    break;

                case NotificationChannel.SMS:
                    await this.sendSms(notification);
                    break;

                default:
                    break;
            }

            notification.status = NotificationStatus.DELIVERED;
            notification.deliveredAt = new Date();
        } catch (error) {
            notification.status = NotificationStatus.FAILED;
            notification.errorMessage = error instanceof Error ? error.message : 'Unknown error';
            notification.retryCount += 1;
            this.logger.error(`Failed to dispatch notification: ${notification.id}`, error);
        }

        await this.notificationRepository.save(notification);
    }

    private async sendPush(notification: Notification): Promise<void> {
        // Firebase Cloud Messaging requires FCM_SERVER_KEY env var
        // Until configured, mark as pending instead of falsely marking delivered
        this.logger.warn(`Push notification ${notification.id} queued but FCM not configured — skipping delivery`);
        throw new Error('Push notifications not configured (FCM_SERVER_KEY missing)');
    }

    private async sendEmail(notification: Notification): Promise<void> {
        // Route email notifications through the BullMQ email queue (handled by EmailProcessor)
        const data = notification.data as Record<string, any> || {};
        await this.emailQueue.add('notification-email', {
            to: data.email || data.recipientEmail,
            subject: notification.titleAr || notification.titleEn || 'إشعار من فائرة',
            template: 'notification',
            context: {
                name: data.recipientName || '',
                body: notification.bodyAr || notification.bodyEn || '',
                subject: notification.titleAr || notification.titleEn || '',
            },
        });
        this.logger.log(`Email notification ${notification.id} added to email queue`);
    }

    private async sendSms(notification: Notification): Promise<void> {
        // Twilio requires TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM env vars
        // Until configured, mark as pending instead of falsely marking delivered
        this.logger.warn(`SMS notification ${notification.id} queued but Twilio not configured — skipping delivery`);
        throw new Error('SMS notifications not configured (TWILIO_SID missing)');
    }

    // ==================== Scheduled Processing ====================

    async processScheduledNotifications(): Promise<number> {
        const now = new Date();

        // Only fetch notifications whose scheduledAt is in the past (ready to send)
        const scheduled = await this.notificationRepository.find({
            where: {
                status: NotificationStatus.PENDING,
                scheduledAt: LessThanOrEqual(now),
            },
            order: { scheduledAt: 'ASC' },
            take: 100,
        });

        let processed = 0;

        for (const notification of scheduled) {
            notification.sentAt = new Date();
            await this.dispatch(notification);
            processed++;
        }

        if (processed > 0) {
            this.logger.log(`Processed ${processed} scheduled notifications`);
        }

        return processed;
    }

    // ==================== Cleanup ====================

    async cleanupExpired(): Promise<number> {
        const result = await this.notificationRepository.delete({
            expiresAt: LessThanOrEqual(new Date()),
        });

        return result.affected || 0;
    }
}
