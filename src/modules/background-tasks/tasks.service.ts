import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionsService } from '../subscriptions/services/subscriptions.service';
import { NotificationsService } from '../notifications/services/notifications.service';
import { SessionsService } from '../sessions/services/sessions.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly notificationsService: NotificationsService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleSubscriptionExpiry() {
    this.logger.log('Running scheduled subscription expiry check...');
    const count = await this.subscriptionsService.processExpiredSubscriptions();
    if (count > 0) {
      this.logger.log(`Marked ${count} subscriptions as expired`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledNotifications() {
    // Only log if we want to be noisy, or keep it quiet
    const count = await this.notificationsService.processScheduledNotifications();
    if (count > 0) {
      this.logger.log(`Processed ${count} scheduled notifications`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleSessionAutoEnd() {
    this.logger.log('Checking for sessions to auto-end...');
    const count = await this.sessionsService.autoEndExpiredSessions();
    if (count > 0) {
      this.logger.log(`Auto-ended ${count} expired sessions`);
    }
  }
}
