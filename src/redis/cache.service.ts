import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class CacheService {
    private readonly prefix: Record<string, string>;
    private readonly ttl: Record<string, number>;

    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        private readonly configService: ConfigService,
    ) {
        this.prefix = this.configService.get('redis.prefix') || {};
        this.ttl = this.configService.get('redis.ttl') || {};
    }

    async get<T>(key: string): Promise<T | null> {
        const value = await this.redis.get(key);
        if (!value) return null;
        return JSON.parse(value) as T;
    }

    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
            await this.redis.setex(key, ttlSeconds, serialized);
        } else {
            await this.redis.set(key, serialized);
        }
    }

    async del(key: string): Promise<void> {
        await this.redis.del(key);
    }

    async delByPattern(pattern: string): Promise<void> {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
            await this.redis.del(...keys);
        }
    }

    // Session cache helpers
    async setSession(userId: string, data: Record<string, unknown>): Promise<void> {
        const key = `${this.prefix.session || 'session:'}${userId}`;
        await this.set(key, data, this.ttl.session || 86400);
    }

    async getSession(userId: string): Promise<Record<string, unknown> | null> {
        const key = `${this.prefix.session || 'session:'}${userId}`;
        return this.get(key);
    }

    async deleteSession(userId: string): Promise<void> {
        const key = `${this.prefix.session || 'session:'}${userId}`;
        await this.del(key);
    }

    async deletePermissions(userId: string): Promise<void> {
        const key = `${this.prefix.permission || 'perm:'}${userId}`;
        await this.del(key);
    }

    // Permission cache helpers
    async setPermissions(userId: string, permissions: string[]): Promise<void> {
        const key = `${this.prefix.permission || 'perm:'}${userId}`;
        await this.set(key, permissions, this.ttl.permission || 3600);
    }

    async getPermissions(userId: string): Promise<string[] | null> {
        const key = `${this.prefix.permission || 'perm:'}${userId}`;
        return this.get(key);
    }

    // Subscription cache helpers
    async setSubscription(userId: string, data: Record<string, unknown>): Promise<void> {
        const key = `${this.prefix.subscription || 'sub:'}${userId}`;
        await this.set(key, data, this.ttl.subscription || 1800);
    }

    async getSubscription(userId: string): Promise<Record<string, unknown> | null> {
        const key = `${this.prefix.subscription || 'sub:'}${userId}`;
        return this.get(key);
    }
}
