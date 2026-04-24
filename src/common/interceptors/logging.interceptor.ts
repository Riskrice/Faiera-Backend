import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const correlationId = request.get('x-correlation-id') || this.generateCorrelationId();

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;
          this.logger.log(
            `${method} ${url} ${statusCode} ${duration}ms - ${ip} - ${userAgent} [${correlationId}]`,
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `${method} ${url} ERROR ${duration}ms - ${ip} - ${error.message} [${correlationId}]`,
          );
        },
      }),
    );
  }

  private generateCorrelationId(): string {
    return crypto.randomUUID();
  }
}
