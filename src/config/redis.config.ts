import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),

    // Connection settings
    maxRetriesPerRequest: 3,
    retryDelayMs: 100,

    // Key prefixes
    prefix: {
        session: 'session:',
        permission: 'perm:',
        subscription: 'sub:',
        cache: 'cache:',
    },

    // TTL defaults (in seconds)
    ttl: {
        session: 86400, // 24 hours
        permission: 3600, // 1 hour
        subscription: 1800, // 30 minutes
        cache: 300, // 5 minutes
    },
}));
