import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WsJwtGuard } from './guards/ws-jwt.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('app.jwtSecret'),
      }),
    }),
  ],
  providers: [WsJwtGuard],
  exports: [WsJwtGuard, JwtModule],
})
export class GatewayModule {}
