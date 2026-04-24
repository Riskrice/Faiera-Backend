import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentAttempt, AttemptStatus } from '../entities/assessment-attempt.entity';
import { AttemptAnswer } from '../entities/attempt-answer.entity';
import { Assessment, AssessmentStatus } from '../entities/assessment.entity';
import { Question } from '../entities/question.entity';
import { AssessmentsService } from './assessments.service';
import { ScoringEngineService, ScoringResult } from './scoring-engine.service';
import { QuestionBankService } from './question-bank.service';
import { StartAttemptDto, SubmitAnswerDto, AttemptResult } from '../dto';

@Injectable()
export class AttemptService {
  private readonly logger = new Logger(AttemptService.name);

  constructor(
    @InjectRepository(AssessmentAttempt)
    private readonly attemptRepository: Repository<AssessmentAttempt>,
    @InjectRepository(AttemptAnswer)
    private readonly answerRepository: Repository<AttemptAnswer>,
    private readonly assessmentsService: AssessmentsService,
    private readonly scoringEngine: ScoringEngineService,
    private readonly questionBank: QuestionBankService,
  ) {}

  async startAttempt(
    dto: StartAttemptDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AssessmentAttempt> {
    const assessment = await this.assessmentsService.findById(dto.assessmentId);

    // Validate assessment is published
    if (assessment.status !== AssessmentStatus.PUBLISHED) {
      throw new BadRequestException('Assessment is not available');
    }

    // Check date restrictions
    const now = new Date();
    if (assessment.startDate && now < assessment.startDate) {
      throw new BadRequestException('Assessment has not started yet');
    }
    if (assessment.endDate && now > assessment.endDate) {
      throw new BadRequestException('Assessment has ended');
    }

    // Check attempt limit
    const existingAttempts = await this.attemptRepository.count({
      where: { assessmentId: dto.assessmentId, userId },
    });

    if (existingAttempts >= assessment.maxAttempts) {
      throw new ForbiddenException('Maximum attempts reached');
    }

    // Check for in-progress attempt
    const inProgressAttempt = await this.attemptRepository.findOne({
      where: {
        assessmentId: dto.assessmentId,
        userId,
        status: AttemptStatus.IN_PROGRESS,
      },
    });

    if (inProgressAttempt) {
      return inProgressAttempt;
    }

    // Get questions for attempt (randomized if configured)
    const questions = await this.assessmentsService.getQuestionsForAttempt(dto.assessmentId);
    const questionOrder = questions.map(q => q.id);

    // Calculate deadline
    let deadlineAt: Date | undefined;
    if (assessment.timeLimitMinutes) {
      deadlineAt = new Date();
      deadlineAt.setMinutes(deadlineAt.getMinutes() + assessment.timeLimitMinutes);
    }

    // Create attempt
    const attempt = this.attemptRepository.create({
      assessmentId: dto.assessmentId,
      userId,
      attemptNumber: existingAttempts + 1,
      status: AttemptStatus.IN_PROGRESS,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      deadlineAt,
      questionOrder,
      ipAddress,
      userAgent,
    });

    await this.attemptRepository.save(attempt);

    // Pre-create answer records
    const answers = questions.map((question, index) => {
      return this.answerRepository.create({
        attemptId: attempt.id,
        questionId: question.id,
        questionOrder: index,
        requiresManualGrading: question.requiresManualGrading(),
      });
    });

    await this.answerRepository.save(answers);

    this.logger.log(`Attempt started: ${attempt.id} by ${userId}`);
    return attempt;
  }

  async getAttemptWithQuestions(
    attemptId: string,
    userId: string,
  ): Promise<{
    attempt: AssessmentAttempt;
    questions: Question[];
  }> {
    const attempt = await this.attemptRepository.findOne({
      where: { id: attemptId, userId },
      relations: ['answers'],
    });

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    const assessment = await this.assessmentsService.findById(attempt.assessmentId);

    // Get questions in attempt order
    const questionMap = new Map(
      assessment.assessmentQuestions.map(aq => [aq.questionId, aq.question]),
    );

    const questions = attempt.questionOrder
      .map(id => questionMap.get(id))
      .filter((q): q is Question => q !== undefined);

    return { attempt, questions };
  }

  async saveAnswer(
    attemptId: string,
    dto: SubmitAnswerDto,
    userId: string,
  ): Promise<AttemptAnswer> {
    const attempt = await this.attemptRepository.findOne({
      where: { id: attemptId, userId },
    });

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt is not in progress');
    }

    // Check deadline
    if (attempt.deadlineAt && new Date() > attempt.deadlineAt) {
      await this.autoSubmitAttempt(attemptId);
      throw new BadRequestException('Attempt has timed out');
    }

    // Find or create answer record
    const answer = await this.answerRepository.findOne({
      where: { attemptId, questionId: dto.questionId },
    });

    if (!answer) {
      throw new NotFoundException('Question not in this attempt');
    }

    // Update answer
    answer.selectedOptions = dto.selectedOptions;
    answer.textAnswer = dto.textAnswer;
    answer.orderedItems = dto.orderedItems;
    answer.matchedPairs = dto.matchedPairs;
    answer.answerData =
      dto.booleanAnswer !== undefined ? { booleanAnswer: dto.booleanAnswer } : undefined;
    answer.timeSpentSeconds = dto.timeSpentSeconds || 0;
    answer.flaggedForReview = dto.flaggedForReview || false;
    answer.answeredAt = new Date();
    answer.skipped = false;

    await this.answerRepository.save(answer);

    // Update attempt activity
    await this.attemptRepository.update(attemptId, {
      lastActivityAt: new Date(),
    });

    return answer;
  }

  async submitAttempt(attemptId: string, userId: string): Promise<AttemptResult> {
    const attempt = await this.attemptRepository.findOne({
      where: { id: attemptId, userId },
      relations: ['answers', 'answers.question'],
    });

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    if (attempt.status !== AttemptStatus.IN_PROGRESS && attempt.status !== AttemptStatus.PAUSED) {
      throw new BadRequestException('Attempt cannot be submitted');
    }

    const assessment = await this.assessmentsService.findById(attempt.assessmentId);

    // Score all answers
    const scoringResults: ScoringResult[] = [];
    let totalPossible = 0;
    let requiresManualGrading = false;

    for (const answer of attempt.answers) {
      const result = this.scoringEngine.scoreAnswer(answer.question, answer);
      scoringResults.push(result);

      answer.isCorrect = result.isCorrect;
      answer.partialScore = result.partialScore;
      answer.earnedPoints = result.earnedPoints;

      if (answer.requiresManualGrading) {
        requiresManualGrading = true;
      }

      totalPossible += answer.question.points;

      // Update question usage stats
      await this.questionBank.updateUsageStats(
        answer.questionId,
        result.isCorrect,
        answer.timeSpentSeconds,
      );
    }

    await this.answerRepository.save(attempt.answers);

    // Calculate totals
    const { earnedPoints, percentageScore, correctAnswers, incorrectAnswers } =
      this.scoringEngine.calculateAttemptScore(scoringResults, totalPossible);

    const skippedQuestions = attempt.answers.filter(a => a.skipped).length;
    const passed = percentageScore >= assessment.passingScore;

    // Update attempt
    attempt.status = requiresManualGrading ? AttemptStatus.SUBMITTED : AttemptStatus.GRADED;
    attempt.submittedAt = new Date();
    attempt.gradedAt = requiresManualGrading ? undefined : new Date();
    attempt.timeSpentSeconds = Math.floor(
      (new Date().getTime() - attempt.startedAt.getTime()) / 1000,
    );
    attempt.earnedPoints = earnedPoints;
    attempt.possiblePoints = totalPossible;
    attempt.percentageScore = percentageScore;
    attempt.passed = passed;
    attempt.correctAnswers = correctAnswers;
    attempt.incorrectAnswers = incorrectAnswers;
    attempt.skippedQuestions = skippedQuestions;

    await this.attemptRepository.save(attempt);

    this.logger.log(`Attempt submitted: ${attemptId} - ${percentageScore}%`);

    return this.buildAttemptResult(attempt, assessment);
  }

  private async autoSubmitAttempt(attemptId: string): Promise<void> {
    const attempt = await this.attemptRepository.findOne({
      where: { id: attemptId },
    });

    if (attempt && attempt.status === AttemptStatus.IN_PROGRESS) {
      attempt.status = AttemptStatus.TIMED_OUT;
      await this.attemptRepository.save(attempt);
      this.logger.log(`Attempt auto-submitted due to timeout: ${attemptId}`);
    }
  }

  async getAttemptResult(attemptId: string, userId: string): Promise<AttemptResult> {
    const attempt = await this.attemptRepository.findOne({
      where: { id: attemptId, userId },
      relations: ['answers', 'answers.question'],
    });

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    const assessment = await this.assessmentsService.findById(attempt.assessmentId);

    return this.buildAttemptResult(attempt, assessment);
  }

  async getUserAttempts(userId: string, assessmentId?: string): Promise<AssessmentAttempt[]> {
    const where: Record<string, unknown> = { userId };
    if (assessmentId) where.assessmentId = assessmentId;

    return this.attemptRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getAttemptsByAssessment(assessmentId: string): Promise<AssessmentAttempt[]> {
    return this.attemptRepository.find({
      where: { assessmentId },
      relations: ['answers', 'answers.question'], // Eager load for grading view if needed, or maybe just answers count
      order: { submittedAt: 'DESC', startedAt: 'DESC' },
    });
  }

  private buildAttemptResult(attempt: AssessmentAttempt, assessment: Assessment): AttemptResult {
    return {
      attemptId: attempt.id,
      assessmentTitle: assessment.titleEn,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      timeSpentSeconds: attempt.timeSpentSeconds,
      totalQuestions: attempt.questionOrder.length,
      answeredQuestions: attempt.answers?.filter(a => !a.skipped).length || 0,
      correctAnswers: attempt.correctAnswers,
      incorrectAnswers: attempt.incorrectAnswers,
      skippedQuestions: attempt.skippedQuestions,
      earnedPoints: attempt.earnedPoints || 0,
      possiblePoints: attempt.possiblePoints || 0,
      percentageScore: attempt.percentageScore || 0,
      passed: attempt.passed || false,
      feedback: attempt.feedback,
      showCorrectAnswers: assessment.showCorrectAnswers,
    };
  }
}
