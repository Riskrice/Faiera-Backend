import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';
import { Assessment, AssessmentStatus } from '../entities/assessment.entity';
import { AssessmentQuestion } from '../entities/assessment-question.entity';
import { Question, QuestionStatus } from '../entities/question.entity';
import { CreateAssessmentDto, UpdateAssessmentDto, AssessmentQueryDto } from '../dto';
import { PaginationQueryDto } from '../../../common/dto';

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepository: Repository<Assessment>,
    @InjectRepository(AssessmentQuestion)
    private readonly assessmentQuestionRepository: Repository<AssessmentQuestion>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
  ) {}

  async create(dto: CreateAssessmentDto, createdBy: string): Promise<Assessment> {
    const assessment = this.assessmentRepository.create({
      ...dto,
      createdBy,
      status: AssessmentStatus.DRAFT,
    });

    await this.assessmentRepository.save(assessment);

    // Add questions if provided
    if (dto.questionIds && dto.questionIds.length > 0) {
      await this.addQuestions(assessment.id, dto.questionIds);
      await this.recalculateTotalPoints(assessment.id);
    }

    this.logger.log(`Assessment created: ${assessment.titleEn}`);
    return this.findById(assessment.id);
  }

  async findAll(
    query: AssessmentQueryDto,
    pagination: PaginationQueryDto,
  ): Promise<{ assessments: Assessment[]; total: number }> {
    const where: FindOptionsWhere<Assessment> = {};

    if (query.type) where.type = query.type;
    if (query.grade) where.grade = query.grade;
    if (query.subject) where.subject = query.subject;
    if (query.courseId) where.courseId = query.courseId;

    const [assessments, total] = await this.assessmentRepository.findAndCount({
      where,
      skip: pagination.skip,
      take: pagination.take,
      order: { createdAt: 'DESC' },
    });

    return { assessments, total };
  }

  async findById(id: string): Promise<Assessment> {
    const assessment = await this.assessmentRepository.findOne({
      where: { id },
      relations: ['assessmentQuestions', 'assessmentQuestions.question'],
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    return assessment;
  }

  async findPublished(grade: string, subject: string): Promise<Assessment[]> {
    return this.assessmentRepository.find({
      where: {
        grade,
        subject,
        status: AssessmentStatus.PUBLISHED,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateAssessmentDto): Promise<Assessment> {
    const assessment = await this.findById(id);

    if (assessment.status === AssessmentStatus.PUBLISHED) {
      throw new BadRequestException('Cannot update published assessment');
    }

    Object.assign(assessment, dto);
    await this.assessmentRepository.save(assessment);

    this.logger.log(`Assessment updated: ${id}`);
    return this.findById(id);
  }

  async addQuestions(assessmentId: string, questionIds: string[]): Promise<void> {
    // Verify assessment exists
    await this.findById(assessmentId);

    // Validate questions exist and are approved
    // Validate questions exist (allow Draft, Pending, Approved)
    const questions = await this.questionRepository.find({
      where: {
        id: In(questionIds),
        status: In([QuestionStatus.APPROVED, QuestionStatus.DRAFT, QuestionStatus.PENDING_REVIEW]),
      },
    });

    if (questions.length !== questionIds.length) {
      throw new BadRequestException('Some questions not found or not approved');
    }

    // Get current max order
    const existingQuestions = await this.assessmentQuestionRepository.find({
      where: { assessmentId },
      order: { sortOrder: 'DESC' },
      take: 1,
    });

    let sortOrder = existingQuestions.length > 0 ? existingQuestions[0].sortOrder + 1 : 0;

    // Add questions
    const assessmentQuestions = questionIds.map(questionId => {
      return this.assessmentQuestionRepository.create({
        assessmentId,
        questionId,
        sortOrder: sortOrder++,
      });
    });

    await this.assessmentQuestionRepository.save(assessmentQuestions);
    await this.recalculateTotalPoints(assessmentId);
  }

  async removeQuestion(assessmentId: string, questionId: string): Promise<void> {
    const result = await this.assessmentQuestionRepository.delete({
      assessmentId,
      questionId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Question not found in assessment');
    }

    await this.recalculateTotalPoints(assessmentId);
  }

  async reorderQuestions(assessmentId: string, questionIds: string[]): Promise<void> {
    const updates = questionIds.map((questionId, index) => {
      return this.assessmentQuestionRepository.update(
        { assessmentId, questionId },
        { sortOrder: index },
      );
    });

    await Promise.all(updates);
  }

  async publish(id: string): Promise<Assessment> {
    const assessment = await this.findById(id);

    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new BadRequestException('Only draft assessments can be published');
    }

    if (assessment.assessmentQuestions.length === 0) {
      throw new BadRequestException('Cannot publish assessment without questions');
    }

    assessment.status = AssessmentStatus.PUBLISHED;
    assessment.publishedAt = new Date();
    await this.assessmentRepository.save(assessment);

    this.logger.log(`Assessment published: ${id}`);
    return assessment;
  }

  async close(id: string): Promise<Assessment> {
    const assessment = await this.findById(id);
    assessment.status = AssessmentStatus.CLOSED;
    await this.assessmentRepository.save(assessment);
    return assessment;
  }

  async archive(id: string): Promise<Assessment> {
    const assessment = await this.findById(id);
    assessment.status = AssessmentStatus.ARCHIVED;
    await this.assessmentRepository.save(assessment);
    return assessment;
  }

  async delete(id: string): Promise<void> {
    const assessment = await this.findById(id);

    if (assessment.status === AssessmentStatus.PUBLISHED) {
      throw new BadRequestException('Cannot delete published assessment');
    }

    await this.assessmentRepository.remove(assessment);
    this.logger.log(`Assessment deleted: ${id}`);
  }

  async getQuestionsForAttempt(assessmentId: string): Promise<Question[]> {
    const assessment = await this.findById(assessmentId);
    const assessmentQuestions = assessment.assessmentQuestions;

    let questions = assessmentQuestions
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(aq => aq.question);

    // Apply question pool if configured
    if (assessment.questionPoolSize && assessment.questionPoolSize < questions.length) {
      questions = this.shuffleArray(questions).slice(0, assessment.questionPoolSize);
    }

    // Shuffle if configured
    if (assessment.shuffleMode === 'questions' || assessment.shuffleMode === 'both') {
      questions = this.shuffleArray(questions);
    }

    return questions;
  }

  private async recalculateTotalPoints(assessmentId: string): Promise<void> {
    const assessmentQuestions = await this.assessmentQuestionRepository.find({
      where: { assessmentId },
      relations: ['question'],
    });

    const totalPoints = assessmentQuestions.reduce((sum, aq) => {
      return sum + (aq.overridePoints || aq.question.points);
    }, 0);

    await this.assessmentRepository.update(assessmentId, { totalPoints });
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
