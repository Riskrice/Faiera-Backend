import { registerAs } from '@nestjs/config';

export default registerAs('app', () => {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret && nodeEnv === 'production') {
        throw new Error('FATAL: JWT_SECRET environment variable is required in production');
    }

    return {
        // Application
        nodeEnv,
        port: parseInt(process.env.PORT || '3000', 10),
        apiPrefix: 'api/v1',

        // Security
        jwtSecret: jwtSecret || 'dev-only-secret-change-in-production',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
        jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        jwtRefreshReuseGraceSeconds: process.env.JWT_REFRESH_REUSE_GRACE_SECONDS || '30s',

        // CORS
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],

        // Rate Limiting
        throttleTtl: parseInt(process.env.THROTTLE_TTL || '60', 10),
        throttleLimit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),

        // Pagination
        defaultPageSize: 20,
        maxPageSize: 100,
    };
});
