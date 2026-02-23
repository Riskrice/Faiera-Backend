import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters';
import { LoggingInterceptor } from './common/interceptors';

async function bootstrap(): Promise<void> {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'],
        rawBody: true,
    });

    // Security headers
    app.use(helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // Serve static files (uploads) — disallow HTML/SVG execution
    app.useStaticAssets(join(__dirname, '..', 'uploads'), {
        prefix: '/uploads/',
        setHeaders: (res) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Content-Security-Policy', "default-src 'none'");
        },
    });

    // Global prefix for API versioning
    app.setGlobalPrefix('api/v1');

    // Global exception filter
    app.useGlobalFilters(new AllExceptionsFilter());

    // Global logging interceptor
    app.useGlobalInterceptors(new LoggingInterceptor());

    // Global validation pipe with strict settings
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // CORS configuration
    app.enableCors({
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
    });

    // Enable graceful shutdown hooks (OnModuleDestroy, OnApplicationShutdown)
    app.enableShutdownHooks();

    const port = process.env.PORT || 4000;
    await app.listen(port);

    logger.log(`🚀 Faiera API is running on: http://localhost:${port}/api/v1`);
    logger.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch((error: Error) => {
    const logger = new Logger('Bootstrap');
    logger.error('Failed to start application', error.stack);
    process.exit(1);
});
