import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Question } from './entities/question.entity';
import { Assessment } from './entities/assessment.entity';
import { AssessmentQuestion } from './entities/assessment-question.entity';
import { AssessmentAttempt } from './entities/assessment-attempt.entity';
import { AttemptAnswer } from './entities/attempt-answer.entity';
import { QuestionCategory } from './entities/question-category.entity';

// Services
import { QuestionCategoriesService } from './services/question-categories.service';
import { QuestionBankService } from './services/question-bank.service';
import { AssessmentsService } from './services/assessments.service';
import { ScoringEngineService } from './services/scoring-engine.service';
import { AttemptService } from './services/attempt.service';

// Controllers
import { QuestionCategoriesController } from './controllers/question-categories.controller';
import { QuestionsController } from './controllers/questions.controller';
import { AssessmentsController } from './controllers/assessments.controller';
import { AttemptsController } from './controllers/attempts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Question,
      Assessment,
      AssessmentQuestion,
      AssessmentAttempt,
      AttemptAnswer,
      QuestionCategory,
    ]),
  ],
  controllers: [QuestionCategoriesController, QuestionsController, AssessmentsController, AttemptsController],
  providers: [QuestionCategoriesService, QuestionBankService, AssessmentsService, ScoringEngineService, AttemptService],
  exports: [QuestionCategoriesService, QuestionBankService, AssessmentsService, ScoringEngineService, AttemptService],
})
export class AssessmentsModule {}
