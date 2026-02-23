import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
    user: {
        sub: string;
        email: string;
        role: string;
    };
}

@Injectable()
export class WsJwtGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const client = context.switchToWs().getClient<Socket>();
        const token = this.extractToken(client);

        if (!token) {
            throw new UnauthorizedException('No token provided');
        }

        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get<string>('app.jwtSecret'),
            });

            // Attach user to socket for later use
            (client as AuthenticatedSocket).user = payload;
            return true;
        } catch {
            throw new UnauthorizedException('Invalid token');
        }
    }

    private extractToken(client: Socket): string | null {
        // Only accept token from auth handshake or Authorization header
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
