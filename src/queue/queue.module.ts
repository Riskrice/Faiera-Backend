import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationProcessor } from './processors/notification.processor';
import { EmailProcessor } from './processors/email.processor';
import { QUEUE_NAMES } from './constants';
import { NotificationsModule } from '../modules/notifications/notifications.module';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password') || undefined,
          db: configService.get<number>('redis.db'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 1000,
        },
      }),
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }, { name: QUEUE_NAMES.EMAILS }),
    NotificationsModule,
  ],
  providers: [NotificationProcessor, EmailProcessor],
  exports: [BullModule, NotificationProcessor, EmailProcessor],
})
export class QueueModule {}
