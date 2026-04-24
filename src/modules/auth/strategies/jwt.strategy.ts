import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../dto';
import { AuthService } from '../services/auth.service';
import { SupabaseAuthService } from '../../supabase/supabase-auth.service';
import { ROLE_PERMISSIONS, Role } from '../constants/roles.constant';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
    private readonly supabaseAuthService: SupabaseAuthService,
  ) {
    const secretOrKey = configService.get<string>('app.jwtSecret');
    if (!secretOrKey) {
      throw new Error('JWT_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Allow both secrets for validation
      secretOrKeyProvider: (_request: any, rawJwtToken: string, done: any) => {
        // Try to decode JWT header to check issuer
        try {
          const [headerB64] = rawJwtToken.split('.');
          const header = JSON.parse(Buffer.from(headerB64, 'base64').toString());

          // Check if it's a Supabase token (has 'kid' in header typically)
          if (header.kid) {
            const supabaseSecret = configService.get<string>('supabase.jwtSecret');
            if (supabaseSecret) {
              return done(null, supabaseSecret);
            }
          }
        } catch (e) {
          // Not a valid JWT format, use default
        }
        return done(null, secretOrKey);
      },
    });
  }

  async validate(payload: any): Promise<JwtPayload> {
    // Check if this is a Supabase token (has 'aud' = 'authenticated')
    if (payload.aud === 'authenticated' && this.supabaseAuthService.isConfigured()) {
      return this.validateSupabasePayload(payload);
    }

    // Local JWT validation
    return this.validateLocalPayload(payload as JwtPayload);
  }

  private async validateLocalPayload(payload: JwtPayload): Promise<JwtPayload> {
    this.logger.debug(
      `Validating local payload for sub: ${payload.sub}, email: ${payload.email}, role: ${payload.role}`,
    );
    const user = await this.authService.validateUser(payload);

    if (!user) {
      this.logger.warn(`User not found or inactive for sub: ${payload.sub}`);
      throw new UnauthorizedException('User not found or inactive');
    }

    this.logger.debug(`User validated successfully: ${user.email}`);
    return payload;
  }

  private async validateSupabasePayload(payload: any): Promise<JwtPayload> {
    // Sync Supabase user to local DB
    const supabaseId = payload.sub;

    // Get or create local user
    const user = await this.supabaseAuthService.getUserBySupabaseId(supabaseId);

    if (!user) {
      // Need to fetch full user from Supabase and sync
      // For now, create a minimal payload - full sync happens on first API call
      this.logger.warn(`Supabase user ${supabaseId} not found locally, will sync on next request`);

      // Return a temporary payload — always assign student role for unsynced users
      return {
        sub: supabaseId,
        email: payload.email || '',
        role: 'student' as Role,
        permissions: ROLE_PERMISSIONS['student'] || [],
      };
    }

    // Return local user as JwtPayload
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: ROLE_PERMISSIONS[user.role] || [],
    };
  }
}
