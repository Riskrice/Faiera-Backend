import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
    imports: [SubscriptionsModule, NotificationsModule, SessionsModule],
    providers: [TasksService],
})
export class BackgroundTasksModule { }
