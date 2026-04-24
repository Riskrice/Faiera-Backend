import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { User, UserStatus } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import {
    RegisterDto,
    LoginDto,
    JwtPayload,
    TokenResponse,
    AuthResponse,
    RegisterResponse,
    VerifyOtpDto,
} from '../dto';
import { Role, ROLE_PERMISSIONS } from '../constants/roles.constant';
import { CacheService } from '../../../redis';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../../queue/constants';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly saltRounds = 12;
    private readonly maxLoginAttempts = 5;
    private readonly lockoutSeconds = 900; // 15 minutes

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(RefreshToken)
        private readonly refreshTokenRepository: Repository<RefreshToken>,
        private readonly jwtService: JwtService,
        private readonly cacheService: CacheService,
        private readonly configService: ConfigService,
        @InjectQueue(QUEUE_NAMES.EMAILS)
        private readonly emailQueue: Queue,
    ) { }

    async register(dto: RegisterDto): Promise<RegisterResponse> {
        const normalizedEmail = dto.email.toLowerCase();

        // Check if user exists
        const existingUser = await this.userRepository.findOne({
            where: { email: normalizedEmail },
        });

        if (existingUser) {
            if (existingUser.status === UserStatus.PENDING) {
                existingUser.firstName = dto.firstName;
                existingUser.lastName = dto.lastName;
                existingUser.phone = dto.phone;
                existingUser.grade = dto.grade;
                existingUser.password = await bcrypt.hash(dto.password, this.saltRounds);
                existingUser.preferredLanguage = dto.preferredLanguage || existingUser.preferredLanguage || 'ar';
                existingUser.status = UserStatus.ACTIVE;
                existingUser.emailVerifiedAt = new Date();
                existingUser.otpCode = null as any;
                existingUser.otpExpiresAt = null as any;
                existingUser.metadata = { ...(existingUser.metadata || {}), hasPassword: true };
                await this.userRepository.save(existingUser);

                await this.sendWelcomeEmail(existingUser);
                this.logger.log(`Updated pending account and activated registration: ${existingUser.email}`);
                return this.buildRegisterResponse(existingUser);
            }

            throw new ConflictException('User with this email already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(dto.password, this.saltRounds);

        // Create user
        const user = this.userRepository.create({
            ...dto,
            email: normalizedEmail,
            password: hashedPassword,
            role: Role.STUDENT,
            status: UserStatus.ACTIVE,
            emailVerifiedAt: new Date(),
            preferredLanguage: dto.preferredLanguage || 'ar',
            metadata: {
                hasPassword: true
            }
        });

        await this.userRepository.save(user);

        await this.sendWelcomeEmail(user);

        this.logger.log(`User registered: ${user.email}`);

        return this.buildRegisterResponse(user);
    }

    async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
        const email = dto.email.toLowerCase();
        const lockoutKey = `login_attempts:${email}`;

        // Check if account is locked out
        const attempts = await this.cacheService.get<number>(lockoutKey);
        if (attempts !== null && attempts >= this.maxLoginAttempts) {
            throw new UnauthorizedException('Account temporarily locked due to too many failed attempts. Try again in 15 minutes.');
        }

        // Find user with password
        const user = await this.userRepository.findOne({
            where: { email },
            select: ['id', 'email', 'password', 'firstName', 'lastName', 'phone', 'role', 'status', 'preferredLanguage', 'metadata', 'googleId'],
        });

        if (!user) {
            // Increment attempts even for non-existent users to prevent enumeration
            await this.cacheService.set(lockoutKey, (attempts || 0) + 1, this.lockoutSeconds);
            throw new UnauthorizedException('Invalid credentials');
        }

        // Check status
        if (user.status !== UserStatus.ACTIVE) {
            throw new UnauthorizedException('Account is not active');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) {
            const newAttempts = (attempts || 0) + 1;
            await this.cacheService.set(lockoutKey, newAttempts, this.lockoutSeconds);
            if (newAttempts >= this.maxLoginAttempts) {
                this.logger.warn(`Account locked for ${email} after ${newAttempts} failed attempts`);
            }
            throw new UnauthorizedException('Invalid credentials');
        }

        // Clear failed attempts on successful login
        await this.cacheService.del(lockoutKey);

        // Update last login
        await this.userRepository.update(user.id, { lastLoginAt: new Date() });

        // Backfill hasPassword for legacy password users after successful verification.
        if (user.metadata?.hasPassword === undefined) {
            const updatedMetadata = { ...(user.metadata || {}), hasPassword: true };
            await this.userRepository.update(user.id, { metadata: updatedMetadata });
            user.metadata = updatedMetadata;
        }

        // Generate tokens
        const tokens = await this.generateTokens(user, ipAddress, userAgent);

        // Cache permissions
        await this.cacheUserPermissions(user);

        this.logger.log(`User logged in: ${user.email}`);

        return this.buildAuthResponse(user, tokens);
    }

    async requestOtp(email: string): Promise<void> {
        const lowerEmail = email.toLowerCase();

        // Find user by email
        const user = await this.userRepository.findOne({
            where: { email: lowerEmail },
        });

        if (!user) {
            // Silently return to prevent email enumeration, but log for debugging
            this.logger.warn(`OTP requested for non-existent email: ${lowerEmail}`);
            return;
        }

        if (user.status !== UserStatus.PENDING) {
            throw new UnauthorizedException('This code is only available for account verification');
        }

        await this.issueOtpForUser(user, 'verification');
    }

    async verifyOtp(dto: VerifyOtpDto, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
        const email = dto.email.toLowerCase();
        const lockoutKey = `otp_attempts:${email}`;

        // Check if account is locked out from OTP attempts
        const attempts = await this.cacheService.get<number>(lockoutKey);
        if (attempts !== null && attempts >= this.maxLoginAttempts) {
            throw new UnauthorizedException('Account temporarily locked due to too many failed OTP attempts. Try again in 15 minutes.');
        }

        // Find user
        const user = await this.userRepository.findOne({
            where: { email },
            select: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'status', 'preferredLanguage', 'metadata', 'googleId', 'otpCode', 'otpExpiresAt'],
        });

        if (!user) {
            await this.cacheService.set(lockoutKey, (attempts || 0) + 1, this.lockoutSeconds);
            throw new UnauthorizedException('Invalid OTP or Email');
        }

        if (user.status !== UserStatus.PENDING) {
            throw new UnauthorizedException('This verification code is only valid for account activation');
        }

        if (!user.otpCode || !user.otpExpiresAt) {
            throw new UnauthorizedException('No OTP was requested for this email');
        }

        if (new Date() > user.otpExpiresAt) {
            throw new UnauthorizedException('OTP has expired');
        }

        // Verify OTP
        const isOtpValid = await bcrypt.compare(dto.otpCode, user.otpCode);
        if (!isOtpValid) {
            const newAttempts = (attempts || 0) + 1;
            await this.cacheService.set(lockoutKey, newAttempts, this.lockoutSeconds);
            throw new UnauthorizedException('Invalid OTP');
        }

        // Clear failed attempts and OTP data
        await this.cacheService.del(lockoutKey);
        const shouldActivate = user.status === UserStatus.PENDING;
        user.otpCode = null as any;
        user.otpExpiresAt = null as any;
        if (shouldActivate) {
            user.status = UserStatus.ACTIVE;
            user.emailVerifiedAt = new Date();
        }
        user.lastLoginAt = new Date();
        await this.userRepository.save(user);

        // Generate tokens
        const tokens = await this.generateTokens(user, ipAddress, userAgent);

        // Cache permissions
        await this.cacheUserPermissions(user);

        if (shouldActivate) {
            await this.sendWelcomeEmail(user);
        }

        this.logger.log(`User verified and logged in: ${user.email}`);

        return this.buildAuthResponse(user, tokens);
    }

    async refreshTokens(refreshToken: string): Promise<TokenResponse> {
        const tokenRecord = await this.refreshTokenRepository.findOne({
            where: { token: refreshToken },
            relations: ['user'],
        });

        if (!tokenRecord) {
            throw new UnauthorizedException('Refresh token invalid or expired');
        }

        if (tokenRecord.isExpired()) {
            throw new UnauthorizedException('Refresh token invalid or expired');
        }

        if (tokenRecord.user.status !== UserStatus.ACTIVE) {
            throw new UnauthorizedException('User account is not active');
        }

        const graceWindowConfig =
            this.configService.get<string | number>('app.jwtRefreshReuseGraceSeconds') || '30s';
        const graceWindowSeconds = this.parseDurationToSeconds(graceWindowConfig, 30);

        if (tokenRecord.isRevoked) {
            const revokedAtMs = tokenRecord.revokedAt?.getTime() || 0;
            const isWithinGraceWindow =
                revokedAtMs > 0 && Date.now() - revokedAtMs <= graceWindowSeconds * 1000;

            if (!isWithinGraceWindow) {
                throw new UnauthorizedException('Refresh token invalid or expired');
            }

            this.logger.warn(
                `Accepted recently revoked refresh token within ${graceWindowSeconds}s grace window for user ${tokenRecord.userId}`,
            );
        } else {
            // Revoke old token on successful refresh rotation.
            await this.refreshTokenRepository.update(tokenRecord.id, {
                isRevoked: true,
                revokedAt: new Date(),
            });
        }

        // Generate new tokens
        return this.generateTokens(tokenRecord.user);
    }

    async logout(userId: string, refreshToken?: string): Promise<void> {
        if (refreshToken) {
            // Revoke specific token
            await this.refreshTokenRepository.update(
                { token: refreshToken },
                { isRevoked: true, revokedAt: new Date() },
            );
        } else {
            // Revoke all tokens for user
            await this.refreshTokenRepository.update(
                { userId, isRevoked: false },
                { isRevoked: true, revokedAt: new Date() },
            );
        }

        // Clear cached session and permissions
        await this.cacheService.deleteSession(userId);
        await this.cacheService.deletePermissions(userId);

        this.logger.log(`User logged out: ${userId}`);
    }

    async changePassword(userId: string, currentPassword: string | undefined, newPassword: string): Promise<void> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'password', 'googleId', 'metadata'],
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const hasPasswordSet = user.metadata?.hasPassword === true || (user.metadata?.hasPassword === undefined && !user.googleId);

        if (hasPasswordSet) {
            if (!currentPassword) {
                throw new BadRequestException('Current password is required to change it');
            }
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                throw new UnauthorizedException('Invalid current password');
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);
        
        await this.userRepository.update(userId, { 
            password: hashedPassword,
        });

        // Set hasPassword to true dynamically using a merged metadata update instead of replacing it
        // Or fetch latest metadata then update
        const updatedMetadata = { ...(user.metadata || {}), hasPassword: true };
        await this.userRepository.update(userId, { metadata: updatedMetadata });

        // Revoke all sessions for security
        await this.logout(userId);
    }

    async forgotPassword(email: string): Promise<void> {
        const user = await this.userRepository.findOne({
            where: { email: email.toLowerCase() },
        });

        // Always return success to prevent email enumeration
        if (!user) {
            this.logger.warn(`Forgot password requested for non-existent email: ${email}`);
            return;
        }

        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Store hashed token with 1-hour expiry
        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour
        await this.userRepository.save(user);

        // Send reset email via queue
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

        await this.emailQueue.add('password-reset', {
            to: user.email,
            subject: 'إعادة تعيين كلمة المرور - Faiera',
            template: 'password-reset',
            context: {
                name: user.firstName,
                resetUrl,
                expiresIn: '1 hour',
            },
        });

        this.logger.log(`Password reset requested for: ${user.email}`);
    }

    async resetPassword(token: string, newPassword: string): Promise<void> {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await this.userRepository.findOne({
            where: {
                passwordResetToken: hashedToken,
                passwordResetExpires: MoreThan(new Date()),
            },
        });

        if (!user) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        // Update password
        const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

        const updatedMetadata = { ...(user.metadata || {}), hasPassword: true };

        await this.userRepository.update(user.id, {
            password: hashedPassword,
            passwordResetToken: null as any,
            passwordResetExpires: null as any,
            metadata: updatedMetadata,
        });

        // Revoke all refresh tokens for security
        await this.logout(user.id);

        this.logger.log(`Password reset completed for: ${user.email}`);
    }

    async validateUser(payload: JwtPayload): Promise<User | null> {
        return this.userRepository.findOne({
            where: { id: payload.sub, status: UserStatus.ACTIVE },
        });
    }

    async getProfile(userId: string): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'email', 'firstName', 'lastName', 'phone', 'role', 'preferredLanguage', 'status', 'metadata', 'googleId'],
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        user.metadata = this.buildUserMetadata(user);

        return user;
    }

    private async generateTokens(
        user: User,
        ipAddress?: string,
        userAgent?: string,
    ): Promise<TokenResponse> {
        const permissions = ROLE_PERMISSIONS[user.role] || [];

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            permissions,
        };

        const accessToken = this.jwtService.sign(payload);

        const refreshTokenValue = uuidv4();
        const refreshExpiresInConfig =
            this.configService.get<string | number>('app.jwtRefreshExpiresIn') || '7d';
        const refreshExpiresInSeconds = this.parseDurationToSeconds(
            refreshExpiresInConfig,
            7 * 24 * 60 * 60,
        );
        const expiresAt = new Date(Date.now() + refreshExpiresInSeconds * 1000);

        // Save refresh token
        const refreshToken = this.refreshTokenRepository.create({
            userId: user.id,
            token: refreshTokenValue,
            expiresAt,
            ipAddress,
            userAgent,
        });
        const expiresInConfig = this.configService.get<string | number>('app.jwtExpiresIn') || '900';
        await this.refreshTokenRepository.save(refreshToken);

        const expiresInSeconds = this.parseDurationToSeconds(expiresInConfig, 900);

        return {
            accessToken,
            refreshToken: refreshTokenValue,
            expiresIn: expiresInSeconds,
            tokenType: 'Bearer',
        };
    }

    private parseDurationToSeconds(value: string | number, fallbackSeconds: number): number {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            return Math.floor(value);
        }

        if (typeof value !== 'string') {
            return fallbackSeconds;
        }

        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return fallbackSeconds;
        }

        const direct = Number.parseInt(normalized, 10);
        if (Number.isFinite(direct) && direct > 0 && /^\d+$/.test(normalized)) {
            return direct;
        }

        const durationMatch = normalized.match(/^(\d+)\s*([smhd])$/);
        if (!durationMatch) {
            return fallbackSeconds;
        }

        const amount = Number.parseInt(durationMatch[1], 10);
        if (!Number.isFinite(amount) || amount <= 0) {
            return fallbackSeconds;
        }

        const unit = durationMatch[2];
        if (unit === 's') return amount;
        if (unit === 'm') return amount * 60;
        if (unit === 'h') return amount * 3600;
        if (unit === 'd') return amount * 86400;

        return fallbackSeconds;
    }

    private async cacheUserPermissions(user: User): Promise<void> {
        // RBAC service owns permission cache population; auth login should only clear stale entries.
        await this.cacheService.deletePermissions(user.id);
    }

    private async issueOtpForUser(user: User, purpose: 'verification' | 'login' = 'login'): Promise<void> {
        const otpCode = crypto.randomInt(100000, 999999).toString();
        const hashedOtp = await bcrypt.hash(otpCode, this.saltRounds);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const normalizedEmail = user.email.toLowerCase();

        user.otpCode = hashedOtp;
        user.otpExpiresAt = expiresAt;
        await this.userRepository.save(user);

        await this.cacheService.del(`otp_attempts:${normalizedEmail}`);

        const isVerification = purpose === 'verification';

        await this.emailQueue.add(isVerification ? 'otp-verification' : 'otp-login', {
            to: user.email,
            subject: isVerification
                ? 'فعّل حسابك على فايرا باستخدام رمز التحقق'
                : 'رمز الدخول إلى حسابك على فايرا',
            template: isVerification ? 'otp-verification' : 'otp-login',
            context: {
                name: user.firstName,
                otpCode,
                expiresInMinutes: 10,
            },
        });

        this.logger.log(`OTP generated for ${purpose} and queued for: ${user.email}`);
    }

    private async sendWelcomeEmail(user: User): Promise<void> {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

        await this.emailQueue.add('welcome', {
            to: user.email,
            subject: 'مرحبًا بك في فايرا! - Faiera',
            template: 'welcome',
            context: {
                name: user.firstName,
                loginUrl: `${frontendUrl}/login`,
            },
        });
    }

    private buildRegisterResponse(user: User): RegisterResponse {
        return {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,
                status: user.status,
                preferredLanguage: user.preferredLanguage,
                metadata: this.buildUserMetadata(user),
            },
            requiresOtp: false,
        };
    }

    async validateOAuthLogin(profile: any): Promise<AuthResponse> {
        let user = await this.userRepository.findOne({ where: { email: profile.email } });
        
        if (!user) {
            user = this.userRepository.create({
                googleId: profile.googleId,
                email: profile.email,
                firstName: profile.firstName,
                lastName: profile.lastName,
                role: Role.STUDENT,
                status: UserStatus.ACTIVE,
                password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
                emailVerifiedAt: new Date(),
                metadata: {
                    avatar: profile.picture,
                    hasPassword: false,
                }
            });
            await this.userRepository.save(user);
        } else if (!user.googleId) {
            user.googleId = profile.googleId;
            const updatedMetadata = {
                ...(user.metadata || {}),
                ...(user.metadata?.avatar || !profile.picture ? {} : { avatar: profile.picture }),
            } as Record<string, unknown>;

            if (updatedMetadata.hasPassword === undefined) {
                updatedMetadata.hasPassword = true;
            }

            user.metadata = updatedMetadata;
            await this.userRepository.save(user);
        }

        const tokens = await this.generateTokens(user, this.configService.get<string>('FRONTEND_URL') || '');

        return this.buildAuthResponse(user, tokens);
    }

    private buildAuthResponse(user: User, tokens: TokenResponse): AuthResponse {
        return {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,
                status: user.status,
                preferredLanguage: user.preferredLanguage,
                metadata: this.buildUserMetadata(user),
            },
            tokens,
        };
    }

    private buildUserMetadata(user: User): Record<string, unknown> {
        const metadata = { ...(user.metadata || {}) } as Record<string, unknown>;
        if (typeof metadata.hasPassword !== 'boolean') {
            metadata.hasPassword = !user.googleId;
        }
        return metadata;
    }
}
