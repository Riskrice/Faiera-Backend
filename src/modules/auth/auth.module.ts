import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Entities
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';

// Services
import { AuthService } from './services/auth.service';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

// Controllers
import { AuthController } from './controllers/auth.controller';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RbacGuard } from './guards/rbac.guard';

@Module({
  imports: [
    // Register entities
    TypeOrmModule.forFeature([User, RefreshToken]),

    // Passport configuration
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JWT configuration
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('app.jwtSecret'),
        signOptions: {
          expiresIn: configService.get<string | number>('app.jwtExpiresIn') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, JwtAuthGuard, RbacGuard],
  exports: [AuthService, JwtAuthGuard, RbacGuard, TypeOrmModule],
})
export class AuthModule {}
