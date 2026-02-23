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
import { Notification } from '../entities/notification.entity';

interface AuthenticatedSocket extends Socket {
    user: {
        sub: string;
        email: string;
        role: string;
    };
}

@WebSocketGateway({
    namespace: '/notifications',
    cors: {
        origin: '*',
        credentials: true,
    },
})
@UseFilters(WsExceptionFilter)
export class NotificationsGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private readonly logger = new Logger(NotificationsGateway.name);
    private connectedUsers = new Map<string, Set<string>>(); // userId -> Set<socketId>

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    afterInit(): void {
        this.logger.log('Notifications WebSocket Gateway initialized');
    }

    async handleConnection(client: Socket): Promise<void> {
        try {
            const token = this.extractToken(client);
            if (!token) {
                this.logger.warn(`Connection rejected: No token provided`);
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

            // Join role-based room
            if (payload.role) {
                await client.join(`role:${payload.role}`);
            }

            // Track connected sockets for this user
            if (!this.connectedUsers.has(userId)) {
                this.connectedUsers.set(userId, new Set());
            }
            this.connectedUsers.get(userId)!.add(client.id);

            this.logger.log(`User ${userId} connected (socket: ${client.id})`);
        } catch (error) {
            this.logger.warn(`Connection rejected: Invalid token - ${error}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket): void {
        const user = (client as AuthenticatedSocket).user;
        if (user?.sub) {
            const userSockets = this.connectedUsers.get(user.sub);
            if (userSockets) {
                userSockets.delete(client.id);
                if (userSockets.size === 0) {
                    this.connectedUsers.delete(user.sub);
                }
            }
            this.logger.log(`User ${user.sub} disconnected (socket: ${client.id})`);
        }
    }

    /**
     * Send notification to a specific user
     */
    sendToUser(userId: string, notification: Partial<Notification>): void {
        this.server.to(`user:${userId}`).emit('notification', {
            type: 'new',
            data: this.formatNotification(notification),
            timestamp: new Date().toISOString(),
        });
        this.logger.debug(`Notification sent to user ${userId}`);
    }

    /**
     * Send notification to all users with a specific role
     */
    sendToRole(role: string, notification: Partial<Notification>): void {
        this.server.to(`role:${role}`).emit('notification', {
            type: 'broadcast',
            data: this.formatNotification(notification),
            timestamp: new Date().toISOString(),
        });
        this.logger.debug(`Notification broadcast to role ${role}`);
    }

    /**
     * Broadcast notification to all connected users
     */
    broadcast(notification: Partial<Notification>): void {
        this.server.emit('notification', {
            type: 'broadcast',
            data: this.formatNotification(notification),
            timestamp: new Date().toISOString(),
        });
        this.logger.debug('Notification broadcast to all users');
    }

    /**
     * Notify user when a notification is marked as read
     */
    notifyRead(userId: string, notificationId: string): void {
        this.server.to(`user:${userId}`).emit('notification:read', {
            notificationId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Update unread count for a user
     */
    updateUnreadCount(userId: string, count: number): void {
        this.server.to(`user:${userId}`).emit('notification:count', {
            unreadCount: count,
            timestamp: new Date().toISOString(),
        });
    }

    @SubscribeMessage('mark:read')
    async handleMarkRead(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: { notificationId: string },
    ): Promise<{ success: boolean }> {
        this.logger.debug(`User ${client.user.sub} marked notification ${data.notificationId} as read`);
        // Actual marking is done via HTTP API, this is just for real-time sync
        return { success: true };
    }

    @SubscribeMessage('ping')
    handlePing(): { event: string; data: string } {
        return { event: 'pong', data: new Date().toISOString() };
    }

    /**
     * Check if a user is currently connected
     */
    isUserConnected(userId: string): boolean {
        return this.connectedUsers.has(userId) && this.connectedUsers.get(userId)!.size > 0;
    }

    /**
     * Get count of connected users
     */
    getConnectedUsersCount(): number {
        return this.connectedUsers.size;
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

    private formatNotification(notification: Partial<Notification>): object {
        return {
            id: notification.id,
            type: notification.type,
            titleEn: notification.titleEn,
            titleAr: notification.titleAr,
            bodyEn: notification.bodyEn,
            bodyAr: notification.bodyAr,
            data: notification.data,
            createdAt: notification.createdAt,
        };
    }
}
