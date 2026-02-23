import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database';
import { RedisModule, CacheService } from './redis';
import { QueueModule } from './queue';
import { GatewayModule } from './gateway';
import { AuthModule, JwtAuthGuard, RbacGuard } from './modules/auth';
import { UsersModule } from './modules/users';
import { ContentManagementModule } from './modules/content';
import { SubscriptionsModule } from './modules/subscriptions';
import { AssessmentsModule } from './modules/assessments';
import { SessionsModule } from './modules/sessions';
import { VideoModule } from './modules/video';
import { TeachersModule } from './modules/teachers';
import { NotificationsModule } from './modules/notifications';
import { ProgressModule } from './modules/progress';
import { UploadModule } from './modules/upload';
import { AnalyticsModule } from './modules/analytics';
import { BunnyModule } from './modules/bunny/bunny.module';
import { SupabaseModule } from './modules/supabase';
import { PaymentsModule } from './modules/payments/payments.module';
import { BackgroundTasksModule } from './modules/background-tasks/background-tasks.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import bunnyConfig from './config/bunny.config';
import supabaseConfig from './config/supabase.config';

@Module({
    imports: [
        // Configuration module - loads environment variables
        ConfigModule.forRoot({
            isGlobal: true,
            load: [appConfig, databaseConfig, redisConfig, bunnyConfig, supabaseConfig],
            envFilePath: ['.env.local', '.env'],
        }),
        ScheduleModule.forRoot(),
        // Rate limiting
        ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ([{
                ttl: (configService.get<number>('app.throttleTtl') || 60) * 1000,
                limit: configService.get<number>('app.throttleLimit') || 100,
            }]),
        }),
        // Static file serving for uploads
        ServeStaticModule.forRoot({
            rootPath: join(process.cwd(), 'uploads'),
            serveRoot: '/uploads',
        }),
        // Infrastructure modules
        DatabaseModule,
        RedisModule,
        QueueModule,
        GatewayModule,
        // Feature modules
        AuthModule,
        UsersModule,
        ContentManagementModule,
        SubscriptionsModule,
        AssessmentsModule,
        SessionsModule,
        VideoModule,
        TeachersModule,
        NotificationsModule,
        ProgressModule,
        UploadModule,
        AnalyticsModule,
        BunnyModule,
        SupabaseModule,
        PaymentsModule,
        BackgroundTasksModule,
    ],
    controllers: [HealthController],
    providers: [
        CacheService,
        // Global guards
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: RbacGuard,
        },
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
    exports: [CacheService],
})
export class AppModule { }
