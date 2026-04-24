import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { TeacherAvailability } from './entities/teacher-availability.entity';
import { TeacherBooking } from './entities/teacher-booking.entity';
import { TeacherReview } from './entities/teacher-review.entity';
import { WithdrawalRequest } from './entities/withdrawal-request.entity';
import { SubscriptionPackage } from './entities/subscription-package.entity';
import { User } from '../auth/entities/user.entity';
import { TeachersService } from './services/teachers.service';
import { TeachersController } from './controllers/teachers.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeacherProfile,
      TeacherAvailability,
      TeacherBooking,
      TeacherReview,
      WithdrawalRequest,
      SubscriptionPackage,
      User,
    ]),
    AuthModule,
  ],
  controllers: [TeachersController],
  providers: [TeachersService],
  exports: [TeachersService],
})
export class TeachersModule {}
