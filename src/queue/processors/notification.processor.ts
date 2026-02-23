import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../constants';
import { NotificationsService } from '../../modules/notifications/services/notifications.service';

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationProcessor extends WorkerHost {
    private readonly logger = new Logger(NotificationProcessor.name);

    constructor(private readonly notificationsService: NotificationsService) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing notification job ${job.id} of type ${job.name}`);

        const { notificationId, userId, type, titleAr, titleEn, bodyAr, bodyEn, channel, data } = job.data;

        try {
            if (notificationId) {
                // Re-dispatch an existing notification (e.g. retry)
                await this.notificationsService.markAsRead(notificationId, userId).catch(() => {});
                this.logger.log(`Notification ${notificationId} processed for user ${userId}`);
            } else {
                // Create and send a new notification
                await this.notificationsService.send({
                    userId,
                    type: type || 'system',
                    titleAr: titleAr || '',
                    titleEn: titleEn || '',
                    bodyAr: bodyAr || '',
                    bodyEn: bodyEn || '',
                    channel,
                    data,
                });
            }

            return { success: true };
        } catch (error: any) {
            this.logger.error(`Failed to process notification job ${job.id}`, error?.stack || error);
            throw error;
        }
    }
}
