import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserProgress } from './entities/progress.entity';
import { ProgressService } from './services/progress.service';
import { ProgressGateway } from './gateways/progress.gateway';
import { ProgressController } from './controllers/progress.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProgress]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('app.jwtSecret'),
      }),
    }),
  ],
  controllers: [ProgressController],
  providers: [ProgressService, ProgressGateway],
  exports: [ProgressService, ProgressGateway],
})
export class ProgressModule {}
