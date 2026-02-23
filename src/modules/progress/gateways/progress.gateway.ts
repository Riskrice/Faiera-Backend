import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseFilters } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsExceptionFilter } from '../../../gateway/filters/ws-exception.filter';
import { ProgressService } from '../services/progress.service';
import { UpdateProgressDto } from '../dto';
import { ContentType } from '../entities/progress.entity';

interface AuthenticatedSocket extends Socket {
    user: {
        sub: string;
        email: string;
        role: string;
    };
}

@WebSocketGateway({
    namespace: '/progress',
    cors: {
        origin: '*',
        credentials: true,
    },
})
@UseFilters(WsExceptionFilter)
export class ProgressGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private readonly logger = new Logger(ProgressGateway.name);
    private connectedUsers = new Map<string, Set<string>>();

    // Debounce storage for progress updates
    private pendingUpdates = new Map<string, { dto: UpdateProgressDto; timer: NodeJS.Timeout }>();
    private readonly DEBOUNCE_MS = 3000; // 3 seconds debounce

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly progressService: ProgressService,
    ) { }

    afterInit(): void {
        this.logger.log('Progress WebSocket Gateway initialized');
    }

    async handleConnection(client: Socket): Promise<void> {
        try {
            const token = this.extractToken(client);
            if (!token) {
                client.disconnect();
                return;
            }

            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get<string>('app.jwtSecret'),
            });

            (client as AuthenticatedSocket).user = payload;
            const userId = payload.sub;

            // Join user's personal room
            await client.join(`user:${userId}`);

            // Track connected sockets
            if (!this.connectedUsers.has(userId)) {
                this.connectedUsers.set(userId, new Set());
            }
            this.connectedUsers.get(userId)!.add(client.id);

            this.logger.log(`User ${userId} connected to progress (socket: ${client.id})`);

            // Sync initial progress data
            const progress = await this.progressService.syncProgress(userId);
            client.emit('progress:synced', {
                progress,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            this.logger.warn(`Progress connection rejected: ${error}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket): void {
        const user = (client as AuthenticatedSocket).user;
        if (user?.sub) {
            // Flush any pending updates before disconnect
            this.flushPendingUpdate(user.sub);

            const userSockets = this.connectedUsers.get(user.sub);
            if (userSockets) {
                userSockets.delete(client.id);
                if (userSockets.size === 0) {
                    this.connectedUsers.delete(user.sub);
                }
            }
            this.logger.log(`User ${user.sub} disconnected from progress`);
        }
    }

    @SubscribeMessage('progress:update')
    async handleProgressUpdate(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() dto: UpdateProgressDto,
    ): Promise<{ success: boolean; debounced?: boolean }> {
        const userId = client.user.sub;
        const key = `${userId}:${dto.contentType}:${dto.contentId}`;

        // Debounce updates to reduce database writes
        const existing = this.pendingUpdates.get(key);
        if (existing) {
            clearTimeout(existing.timer);
        }

        const timer = setTimeout(async () => {
            await this.saveProgress(userId, dto);
            this.pendingUpdates.delete(key);
        }, this.DEBOUNCE_MS);

        this.pendingUpdates.set(key, { dto, timer });

        // For significant progress changes (completion), save immediately
        if (dto.progressPercent >= 100) {
            clearTimeout(timer);
            this.pendingUpdates.delete(key);
            await this.saveProgress(userId, dto);
            return { success: true };
        }

        return { success: true, debounced: true };
    }

    @SubscribeMessage('progress:sync')
    async handleSync(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: { contentType?: ContentType },
    ): Promise<void> {
        const userId = client.user.sub;
        const progress = await this.progressService.syncProgress(userId, data.contentType);

        client.emit('progress:synced', {
            progress,
            timestamp: new Date().toISOString(),
        });
    }

    @SubscribeMessage('progress:get')
    async handleGetProgress(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: { contentType: ContentType; contentId: string },
    ): Promise<void> {
        const userId = client.user.sub;
        const progress = await this.progressService.getProgress(
            userId,
            data.contentType,
            data.contentId,
        );

        client.emit('progress:data', {
            contentType: data.contentType,
            contentId: data.contentId,
            progress,
            timestamp: new Date().toISOString(),
        });
    }

    @SubscribeMessage('ping')
    handlePing(): { event: string; data: string } {
        return { event: 'pong', data: new Date().toISOString() };
    }

    /**
     * Notify user about progress update (from another device)
     */
    notifyProgressUpdate(userId: string, contentType: ContentType, contentId: string, progressPercent: number): void {
        this.server.to(`user:${userId}`).emit('progress:updated', {
            contentType,
            contentId,
            progressPercent,
            timestamp: new Date().toISOString(),
        });
    }

    private async saveProgress(userId: string, dto: UpdateProgressDto): Promise<void> {
        try {
            const progress = await this.progressService.updateProgress(userId, dto);

            // Notify all connected devices about the update
            this.server.to(`user:${userId}`).emit('progress:updated', {
                contentType: dto.contentType,
                contentId: dto.contentId,
                progressPercent: progress.progressPercent,
                completedAt: progress.completedAt,
                timestamp: new Date().toISOString(),
            });

            this.logger.debug(`Progress saved: ${userId} - ${dto.contentType}:${dto.contentId} @ ${dto.progressPercent}%`);
        } catch (error) {
            this.logger.error(`Failed to save progress: ${error}`);
        }
    }

    private flushPendingUpdate(userId: string): void {
        for (const [key, value] of this.pendingUpdates.entries()) {
            if (key.startsWith(userId)) {
                clearTimeout(value.timer);
                this.saveProgress(userId, value.dto);
                this.pendingUpdates.delete(key);
            }
        }
    }

    private extractToken(client: Socket): string | null {
        const authHeader = client.handshake.auth?.token ||
            client.handshake.headers?.authorization;

        if (authHeader) {
            if (authHeader.startsWith('Bearer ')) {
                return authHeader.slice(7);
            }
            return authHeader;
        }

        return null;
    }
}
