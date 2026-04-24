import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Question, QuestionStatus, QuestionType } from '../entities/question.entity';
import { CreateQuestionDto, UpdateQuestionDto, ReviewQuestionDto, QuestionQueryDto } from '../dto';
import { PaginationQueryDto } from '../../../common/dto';

@Injectable()
export class QuestionBankService {
  private readonly logger = new Logger(QuestionBankService.name);

  constructor(
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
  ) {}

  async create(dto: CreateQuestionDto, createdBy: string): Promise<Question> {
    // Prepare answer data based on question type
    const answerData = this.prepareAnswerData(dto);

    const question = this.questionRepository.create({
      ...dto,
      answerData,
      createdBy,
      status: QuestionStatus.DRAFT,
    });

    await this.questionRepository.save(question);
    this.logger.log(`Question created: ${question.id} by ${createdBy}`);
    return question;
  }

  async findAll(
    query: QuestionQueryDto,
    pagination: PaginationQueryDto,
  ): Promise<{ questions: Question[]; total: number }> {
    const where: FindOptionsWhere<Question> = {};

    if (query.type) where.type = query.type;
    if (query.difficulty) where.difficulty = query.difficulty;
    if (query.grade) where.grade = query.grade;
    if (query.subject) where.subject = query.subject;
    if (query.topic) where.topic = query.topic;
    if (query.status) where.status = query.status;
    if (query.createdBy) where.createdBy = query.createdBy;

    const [questions, total] = await this.questionRepository.findAndCount({
      where,
      skip: pagination.skip,
      take: pagination.take,
      order: { createdAt: 'DESC' },
    });

    return { questions, total };
  }

  async findById(id: string): Promise<Question> {
    const question = await this.questionRepository.findOne({ where: { id } });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  async findApprovedQuestions(
    grade: string,
    subject: string,
    filters?: {
      type?: QuestionType;
      topic?: string;
      difficulty?: string;
      limit?: number;
    },
  ): Promise<Question[]> {
    const where: FindOptionsWhere<Question> = {
      grade,
      subject,
      status: QuestionStatus.APPROVED,
    };

    if (filters?.type) where.type = filters.type;
    if (filters?.topic) where.topic = filters.topic;
    if (filters?.difficulty) where.difficulty = filters.difficulty as Question['difficulty'];

    return this.questionRepository.find({
      where,
      take: filters?.limit || 100,
      order: { difficulty: 'ASC', createdAt: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateQuestionDto): Promise<Question> {
    const question = await this.findById(id);

    // If updating options, rebuild answer data
    if (dto.options) {
      question.answerData = dto.options;
    }

    Object.assign(question, dto);
    question.version += 1;

    await this.questionRepository.save(question);
    this.logger.log(`Question updated: ${id} (v${question.version})`);
    return question;
  }

  async submitForReview(id: string): Promise<Question> {
    const question = await this.findById(id);

    if (question.status !== QuestionStatus.DRAFT) {
      throw new BadRequestException('Only draft questions can be submitted for review');
    }

    question.status = QuestionStatus.PENDING_REVIEW;
    await this.questionRepository.save(question);

    this.logger.log(`Question submitted for review: ${id}`);
    return question;
  }

  async review(id: string, dto: ReviewQuestionDto, reviewerId: string): Promise<Question> {
    const question = await this.findById(id);

    if (question.status !== QuestionStatus.PENDING_REVIEW) {
      throw new BadRequestException('Question is not pending review');
    }

    question.status = dto.status;
    question.reviewedBy = reviewerId;
    question.reviewedAt = new Date();
    question.reviewNotes = dto.reviewNotes;

    await this.questionRepository.save(question);

    this.logger.log(`Question reviewed: ${id} - ${dto.status}`);
    return question;
  }

  async getPendingReviewQuestions(pagination: PaginationQueryDto): Promise<{
    questions: Question[];
    total: number;
  }> {
    const [questions, total] = await this.questionRepository.findAndCount({
      where: { status: QuestionStatus.PENDING_REVIEW },
      skip: pagination.skip,
      take: pagination.take,
      order: { createdAt: 'ASC' },
    });

    return { questions, total };
  }

  async archive(id: string): Promise<Question> {
    const question = await this.findById(id);
    question.status = QuestionStatus.ARCHIVED;
    await this.questionRepository.save(question);
    return question;
  }

  async delete(id: string): Promise<void> {
    const question = await this.findById(id);
    await this.questionRepository.remove(question);
    this.logger.log(`Question deleted: ${id}`);
  }

  async updateUsageStats(
    questionId: string,
    wasCorrect: boolean,
    timeSpent: number,
  ): Promise<void> {
    const question = await this.findById(questionId);

    const newUsageCount = question.usageCount + 1;
    const newCorrectRate =
      (question.correctRate * question.usageCount + (wasCorrect ? 100 : 0)) / newUsageCount;
    const newAvgTime = (question.avgTimeSeconds * question.usageCount + timeSpent) / newUsageCount;

    await this.questionRepository.update(questionId, {
      usageCount: newUsageCount,
      correctRate: Math.round(newCorrectRate * 100) / 100,
      avgTimeSeconds: Math.round(newAvgTime * 100) / 100,
    });
  }

  async getRandomQuestions(
    grade: string,
    subject: string,
    count: number,
    excludeIds: string[] = [],
  ): Promise<Question[]> {
    const queryBuilder = this.questionRepository
      .createQueryBuilder('question')
      .where('question.grade = :grade', { grade })
      .andWhere('question.subject = :subject', { subject })
      .andWhere('question.status = :status', { status: QuestionStatus.APPROVED });

    if (excludeIds.length > 0) {
      queryBuilder.andWhere('question.id NOT IN (:...excludeIds)', { excludeIds });
    }

    // Random selection using RANDOM()
    queryBuilder.orderBy('RANDOM()').limit(count);

    return queryBuilder.getMany();
  }

  private prepareAnswerData(dto: CreateQuestionDto): Question['answerData'] {
    if (dto.options && dto.options.length > 0) {
      return dto.options;
    }
    return dto.answerData || {};
  }
}
