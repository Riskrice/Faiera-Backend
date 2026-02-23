import { Module, Global, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: REDIS_CLIENT,
            inject: [ConfigService],
            useFactory: (configService: ConfigService): Redis => {
                const redis = new Redis({
                    host: configService.get<string>('redis.host'),
                    port: configService.get<number>('redis.port'),
                    password: configService.get<string>('redis.password') || undefined,
                    db: configService.get<number>('redis.db'),
                    maxRetriesPerRequest: 3,
                    retryStrategy: (times: number) => {
                        if (times > 3) {
                            return null; // Stop retrying
                        }
                        return Math.min(times * 100, 3000);
                    },
                    lazyConnect: true,
                });

                const logger = new Logger('RedisModule');

                redis.on('error', (err: Error) => {
                    logger.error(`Redis connection error: ${err.message}`);
                });

                redis.on('connect', () => {
                    logger.log('Redis connected successfully');
                });

                return redis;
            },
        },
        CacheService,
    ],
    exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule { }
