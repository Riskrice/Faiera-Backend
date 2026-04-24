import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { UserProgress } from '../progress/entities/progress.entity';
import { Course } from '../content/entities/course.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { Assessment } from '../assessments/entities/assessment.entity';
import { AssessmentAttempt } from '../assessments/entities/assessment-attempt.entity';
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsController } from './controllers/analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Subscription,
      UserProgress,
      Course,
      Lesson,
      Assessment,
      AssessmentAttempt,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
