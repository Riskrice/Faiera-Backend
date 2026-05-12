import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    // Fallback checks for empty environment variables
    const clientID = configService.get<string>('google.clientId') || 'none';
    const clientSecret = configService.get<string>('google.clientSecret') || 'none';
    super({
      clientID,
      clientSecret,
      callbackURL:
        configService.get<string>('google.authCallbackUrl') ||
        'http://localhost:4000/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;

    // Read the redirect destination saved in cookie before OAuth started
    const redirectAfterLogin: string | undefined = req.cookies?.oauth_redirect || undefined;

    const user = {
      googleId: id,
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos[0].value,
      accessToken,
      redirectAfterLogin,
    };
    done(null, user);
  }
}
