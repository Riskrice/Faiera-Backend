import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Transaction } from './entities/transaction.entity';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentsService } from './services/payments.service';
import { FawaterkService } from './services/fawaterk.service';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ContentManagementModule } from '../content/content.module';
import fawaterkConfig from '../../config/fawaterk.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    ConfigModule.forFeature(fawaterkConfig),
    SessionsModule,
    UsersModule,
    SubscriptionsModule,
    ContentManagementModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, FawaterkService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
