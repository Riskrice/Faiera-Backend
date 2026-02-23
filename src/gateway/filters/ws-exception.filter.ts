import { Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
    private readonly logger = new Logger(WsExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const client = host.switchToWs().getClient<Socket>();

        let error = {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
        };

        if (exception instanceof WsException) {
            const wsError = exception.getError();
            error = typeof wsError === 'string'
                ? { code: 'WS_ERROR', message: wsError }
                : (wsError as typeof error);
        } else if (exception instanceof HttpException) {
            error = {
                code: exception.name,
                message: exception.message,
            };
        } else if (exception instanceof Error) {
            error = {
                code: 'ERROR',
                message: exception.message,
            };
        }

        this.logger.error(`WebSocket error: ${error.message}`, exception instanceof Error ? exception.stack : '');

        client.emit('error', {
            success: false,
            error,
            timestamp: new Date().toISOString(),
        });
    }
}
