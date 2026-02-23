import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

export interface JitsiRoomConfig {
    domain: string;
    roomName: string;
    displayName: string;
    email?: string;
    isHost: boolean;
    subject?: string;
    jwt?: string;
    configOverwrite: Record<string, unknown>;
    interfaceConfigOverwrite: Record<string, unknown>;
}

export interface JoinValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * JaaS (Jitsi as a Service) Configuration
 * 
 * To use JaaS:
 * 1. Sign up at https://jaas.8x8.vc/
 * 2. Create an API key and get your App ID
 * 3. Download your private key (.pk file)
 * 4. Set environment variables:
 *    - JAAS_APP_ID: Your JaaS App ID (e.g., vpaas-magic-cookie-xxxxxx)
 *    - JAAS_API_KEY: Your API Key ID
 *    - JAAS_PRIVATE_KEY: Base64 encoded private key content
 * 
 * If JaaS is not configured, falls back to public Jitsi (with lobby limitations)
 */
@Injectable()
export class JitsiService {
    private readonly logger = new Logger(JitsiService.name);

    // JaaS configuration
    private readonly jaasAppId: string | undefined;
    private readonly jaasApiKey: string | undefined;
    private readonly jaasPrivateKey: string | undefined;

    // Fallback to public Jitsi (has lobby limitations)
    private readonly defaultDomain = 'meet.jit.si';

    constructor(private readonly configService: ConfigService) {
        this.jaasAppId = this.configService.get<string>('JAAS_APP_ID');
        this.jaasApiKey = this.configService.get<string>('JAAS_API_KEY');
        const privateKeyBase64 = this.configService.get<string>('JAAS_PRIVATE_KEY');

        if (privateKeyBase64) {
            try {
                this.jaasPrivateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');
            } catch (e) {
                this.logger.warn('Failed to decode JAAS_PRIVATE_KEY');
            }
        }

        if (this.isJaaSConfigured()) {
            this.logger.log('JaaS (Jitsi as a Service) is configured');
        } else {
            this.logger.warn('JaaS not configured. Using public Jitsi (lobby may be enforced)');
            this.logger.warn('To fix lobby issues, configure JaaS: https://jaas.8x8.vc/');
        }

        this.logger.log(`JitsiService initialized. JaaS Configured: ${this.isJaaSConfigured()}`);
    }

    /**
     * Check if JaaS is properly configured
     */
    isJaaSConfigured(): boolean {
        return !!(this.jaasAppId && this.jaasApiKey && this.jaasPrivateKey);
    }

    /**
     * Get the Jitsi domain based on configuration
     */
    getDomain(): string {
        if (this.isJaaSConfigured()) {
            return '8x8.vc';
        }
        return this.defaultDomain;
    }

    /**
     * Generate secure room name for a session
     * Format depends on whether JaaS is configured
     */
    generateRoomName(_sessionId?: string): string {
        const timestamp = Date.now().toString(36);
        const randomSuffix = crypto.randomBytes(6).toString('hex');

        // For JaaS, room name is just the unique identifier
        // The full path will be: {appId}/{roomName}
        const roomName = `faiera-${timestamp}-${randomSuffix}`;

        this.logger.log(`Generated Jitsi room: ${roomName}`);
        return roomName;
    }

    /**
     * Get the full room name including JaaS App ID if configured
     */
    getFullRoomName(roomName: string): string {
        if (this.isJaaSConfigured()) {
            return `${this.jaasAppId}/${roomName}`;
        }
        return roomName;
    }

    /**
     * Generate JaaS JWT token for authenticated access
     * This gives full control over moderator permissions and lobby
     */
    generateJaaSToken(params: {
        roomName: string;
        userId: string;
        userName: string;
        userEmail?: string;
        isModerator: boolean;
        avatar?: string;
    }): string | undefined {
        if (!this.isJaaSConfigured()) {
            return undefined;
        }

        const now = Math.floor(Date.now() / 1000);
        const exp = now + 7200; // 2 hours

        // JaaS JWT payload
        // Reference: https://developer.8x8.com/jaas/docs/api-keys-jwt
        const payload = {
            aud: 'jitsi',
            iss: 'chat',
            sub: this.jaasAppId,
            room: params.roomName, // Just the room name, not the full path
            exp,
            nbf: now - 10,
            context: {
                user: {
                    id: params.userId,
                    name: params.userName,
                    email: params.userEmail || '',
                    avatar: params.avatar || '',
                    moderator: params.isModerator,
                },
                features: {
                    livestreaming: params.isModerator,
                    'outbound-call': params.isModerator,
                    transcription: true,
                    recording: params.isModerator,
                },
                room: {
                    // IMPORTANT: This disables lobby for this user
                    lobby_bypass: true,
                },
            },
        };

        try {
            const token = jwt.sign(payload, this.jaasPrivateKey!, {
                algorithm: 'RS256',
                header: {
                    alg: 'RS256',
                    typ: 'JWT',
                    kid: this.jaasApiKey,
                },
            });

            this.logger.debug(`Generated JaaS JWT for user ${params.userId}, moderator: ${params.isModerator}`);
            return token;
        } catch (error) {
            this.logger.error('Failed to generate JaaS JWT. Private Key length: ' + (this.jaasPrivateKey?.length || 0));
            this.logger.error(error);
            return undefined;
        }
    }

    /**
     * Get full room URL
     */
    getRoomUrl(roomName: string, domain?: string): string {
        const useDomain = domain || this.getDomain();
        const fullRoomName = this.getFullRoomName(roomName);
        return `https://${useDomain}/${fullRoomName}`;
    }

    /**
     * Generate room configuration for frontend
     */
    getRoomConfig(params: {
        roomName: string;
        displayName: string;
        email?: string;
        isHost: boolean;
        sessionTitle?: string;
        domain?: string;
        userId?: string;
    }): JitsiRoomConfig {
        const domain = this.getDomain();
        const fullRoomName = this.getFullRoomName(params.roomName);

        // Generate JaaS JWT if configured
        const jwtToken = this.generateJaaSToken({
            roomName: params.roomName,
            userId: params.userId || uuidv4(),
            userName: params.displayName,
            userEmail: params.email,
            isModerator: params.isHost,
        });

        // Base config overwrite
        const configOverwrite: Record<string, unknown> = {
            startWithAudioMuted: !params.isHost,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            enableWelcomePage: false,
            toolbarButtons: [
                'microphone', 'camera', 'desktop', 'chat', 'raisehand',
                'participants-pane', 'tileview', 'fullscreen', 'settings', 'hangup',
            ],
            requireDisplayName: true,
            hideConferenceTimer: false,
            subject: params.sessionTitle,
            enableInsecureRoomNameWarning: false,
            notifications: [],
        };

        // If JaaS is configured, we have full control via JWT
        // If not, these settings may be ignored by public servers
        if (!this.isJaaSConfigured()) {
            // Try to disable lobby (may not work on public servers)
            configOverwrite['lobby.enabled'] = false;
            configOverwrite['security.lobby.enabled'] = false;
        }

        return {
            domain,
            roomName: fullRoomName,
            displayName: params.displayName,
            email: params.email,
            isHost: params.isHost,
            subject: params.sessionTitle,
            jwt: jwtToken,
            configOverwrite,
            interfaceConfigOverwrite: {
                DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                MOBILE_APP_PROMO: false,
                SHOW_CHROME_EXTENSION_BANNER: false,
            },
        };
    }

    /**
     * Validate if user can join session
     */
    validateJoinRequest(params: {
        sessionStatus: string;
        scheduledStartTime: Date;
        scheduledEndTime: Date;
        isRegistered: boolean;
        isPaidSession: boolean;
        hasPaid: boolean;
        currentParticipants: number;
        maxParticipants: number;
    }): JoinValidationResult {
        const now = new Date();
        const startTime = new Date(params.scheduledStartTime);
        const endTime = new Date(params.scheduledEndTime);

        // Check registration
        if (!params.isRegistered) {
            return {
                valid: false,
                error: 'يجب التسجيل في الجلسة أولاً',
            };
        }

        // Check session status
        if (params.sessionStatus === 'ended') {
            return {
                valid: false,
                error: 'انتهت هذه الجلسة',
            };
        }

        if (params.sessionStatus === 'cancelled') {
            return {
                valid: false,
                error: 'تم إلغاء هذه الجلسة',
            };
        }

        // Check time window (allow 10 minutes before)
        const joinWindowStart = new Date(startTime);
        joinWindowStart.setMinutes(joinWindowStart.getMinutes() - 10);

        if (params.sessionStatus === 'scheduled' && now < joinWindowStart) {
            const minutesUntilJoin = Math.ceil((joinWindowStart.getTime() - now.getTime()) / 60000);
            return {
                valid: false,
                error: `الجلسة لم تبدأ بعد. يمكنك الانضمام بعد ${minutesUntilJoin} دقيقة`,
            };
        }

        // Check if session time has passed (1 hour grace period)
        const gracePeriodEnd = new Date(endTime);
        gracePeriodEnd.setHours(gracePeriodEnd.getHours() + 1);

        if (now > gracePeriodEnd) {
            return {
                valid: false,
                error: 'انتهى وقت الجلسة',
            };
        }

        // Check payment for paid sessions
        if (params.isPaidSession && !params.hasPaid) {
            return {
                valid: false,
                error: 'يجب الدفع للانضمام لهذه الجلسة',
            };
        }

        // Check capacity
        if (params.currentParticipants >= params.maxParticipants) {
            return {
                valid: false,
                error: 'الجلسة ممتلئة',
            };
        }

        return { valid: true };
    }

    /**
     * Generate secure join token
     */
    generateJoinToken(sessionId: string, userId: string, role: 'host' | 'participant'): string {
        const payload = {
            sessionId,
            userId,
            role,
            iat: Date.now(),
            exp: Date.now() + 3600000, // 1 hour expiry
            nonce: uuidv4(),
        };

        return Buffer.from(JSON.stringify(payload)).toString('base64url');
    }

    /**
     * Validate join token
     */
    validateJoinToken(token: string): {
        valid: boolean;
        sessionId?: string;
        userId?: string;
        role?: string;
        error?: string;
    } {
        try {
            const decoded = Buffer.from(token, 'base64url').toString();
            const payload = JSON.parse(decoded);

            // Check expiry
            if (Date.now() > payload.exp) {
                return { valid: false, error: 'Token expired' };
            }

            return {
                valid: true,
                sessionId: payload.sessionId,
                userId: payload.userId,
                role: payload.role,
            };
        } catch {
            return { valid: false, error: 'Invalid token' };
        }
    }
}
