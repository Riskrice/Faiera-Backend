import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, SelectQueryBuilder } from 'typeorm';
import {
  BlankAnswer,
  MatchingPair,
  MCQOption,
  Question,
  QuestionStatus,
  QuestionType,
} from '../entities/question.entity';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  ReviewQuestionDto,
  QuestionQueryDto,
  questionSortableFields,
  QuestionAnalyticsQueryDto,
} from '../dto';
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
    this.validateQuestionPayload({ ...dto, answerData });

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
    const queryBuilder = this.buildFindAllQuery(query);

    const sortBy =
      query.sortBy && questionSortableFields.includes(query.sortBy)
        ? query.sortBy
        : 'sortOrder';
    const sortOrder = query.sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const [questions, total] = await queryBuilder
      .orderBy(sortBy === 'sortOrder' ? 'question.sortOrder' : `question.${sortBy}`, sortOrder)
      .addOrderBy('question.id', 'DESC')
      .skip(pagination.skip)
      .take(pagination.take)
      .getManyAndCount();

    return { questions, total };
  }

  async reorderQuestions(items: { questionId: string; sortOrder: number }[]): Promise<void> {
    await this.questionRepository.manager.transaction(async manager => {
      for (const item of items) {
        await manager.update(Question, item.questionId, { sortOrder: item.sortOrder });
      }
    });
  }

  async getAnalytics(query: QuestionAnalyticsQueryDto): Promise<any> {
    const qb = this.questionRepository.createQueryBuilder('question');

    if (query.categoryId) qb.andWhere('question.categoryId = :categoryId', { categoryId: query.categoryId });
    if (query.grade) qb.andWhere('question.grade = :grade', { grade: query.grade });
    if (query.subject) qb.andWhere('question.subject = :subject', { subject: query.subject });

    qb.andWhere('question.status != :status', { status: QuestionStatus.ARCHIVED });

    const totalQuestions = await qb.getCount();

    const { avgCorrectRate, avgTimeSeconds } = await qb
      .select('AVG(question.correctRate)', 'avgCorrectRate')
      .addSelect('AVG(question.avgTimeSeconds)', 'avgTimeSeconds')
      .getRawOne();

    const difficultyDistribution = await qb.clone()
      .select('question.difficulty', 'value')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('question.difficulty')
      .getRawMany();

    const typeDistribution = await qb.clone()
      .select('question.type', 'value')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('question.type')
      .getRawMany();

    const bloomDistribution = await qb.clone()
      .select('question.cognitiveLevel', 'value')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('question.cognitiveLevel')
      .getRawMany();

    const allQuestions = await qb.clone()
      .select(['question.id', 'question.questionAr', 'question.correctRate', 'question.usageCount', 'question.type', 'question.avgTimeSeconds', 'question.estimatedTimeSeconds'])
      .getMany();

    const scatterData = allQuestions.map(q => ({
      id: q.id,
      text: q.questionAr,
      correctRate: Number(q.correctRate),
      usageCount: q.usageCount,
      type: q.type,
    }));

    const flaggedQuestions = allQuestions
      .filter(q => 
        Number(q.correctRate) < 20 || 
        Number(q.correctRate) > 90 || 
        q.usageCount === 0 || 
        (q.estimatedTimeSeconds && q.avgTimeSeconds > q.estimatedTimeSeconds * 2)
      )
      .map(q => {
        let reason = '';
        if (Number(q.correctRate) < 20) reason = 'صعب جداً';
        else if (Number(q.correctRate) > 90) reason = 'سهل جداً';
        else if (q.usageCount === 0) reason = 'لم تُستخدم بعد';
        else if (q.estimatedTimeSeconds && q.avgTimeSeconds > q.estimatedTimeSeconds * 2) reason = 'وقت طويل جداً';

        return {
          id: q.id,
          text: q.questionAr,
          correctRate: Number(q.correctRate),
          usageCount: q.usageCount,
          reason,
        };
      });

    const sortedByUsageDesc = [...allQuestions].sort((a, b) => b.usageCount - a.usageCount);
    const topUsed = sortedByUsageDesc.slice(0, 10).map(q => ({
      id: q.id,
      text: q.questionAr,
      usageCount: q.usageCount,
      correctRate: Number(q.correctRate),
    }));

    const sortedByUsageAsc = [...allQuestions].sort((a, b) => a.usageCount - b.usageCount);
    const leastUsed = sortedByUsageAsc.slice(0, 10).map(q => ({
      id: q.id,
      text: q.questionAr,
      usageCount: q.usageCount,
      correctRate: Number(q.correctRate),
    }));

    return {
      totalQuestions,
      avgCorrectRate: Number(avgCorrectRate || 0),
      avgTimeSeconds: Number(avgTimeSeconds || 0),
      flaggedCount: flaggedQuestions.length,
      difficultyDistribution,
      typeDistribution,
      bloomDistribution,
      scatterData,
      flaggedQuestions,
      topUsed,
      leastUsed,
    };
  }

  async getFacetCounts(query: QuestionQueryDto): Promise<{
    types: Array<{ value: string; count: number }>;
    difficulties: Array<{ value: string; count: number }>;
    cognitiveLevels: Array<{ value: string; count: number }>;
    statuses: Array<{ value: string; count: number }>;
    grades: Array<{ value: string; count: number }>;
    subjects: Array<{ value: string; count: number }>;
    topics: Array<{ value: string; count: number }>;
    subtopics: Array<{ value: string; count: number }>;
  }> {
    const queryBuilder = this.buildFindAllQuery(query);

    const [typeRows, difficultyRows, cognitiveRows, statusRows, gradeRows, subjectRows] =
      await Promise.all([
        queryBuilder
          .clone()
          .select('question.type', 'value')
          .addSelect('COUNT(*)', 'count')
          .groupBy('question.type')
          .orderBy('count', 'DESC')
          .getRawMany(),
        queryBuilder
          .clone()
          .select('question.difficulty', 'value')
          .addSelect('COUNT(*)', 'count')
          .groupBy('question.difficulty')
          .orderBy('count', 'DESC')
          .getRawMany(),
        queryBuilder
          .clone()
          .select('question.cognitiveLevel', 'value')
          .addSelect('COUNT(*)', 'count')
          .groupBy('question.cognitiveLevel')
          .orderBy('count', 'DESC')
          .getRawMany(),
        queryBuilder
          .clone()
          .select('question.status', 'value')
          .addSelect('COUNT(*)', 'count')
          .groupBy('question.status')
          .orderBy('count', 'DESC')
          .getRawMany(),
        queryBuilder
          .clone()
          .select('question.grade', 'value')
          .addSelect('COUNT(*)', 'count')
          .groupBy('question.grade')
          .orderBy('count', 'DESC')
          .getRawMany(),
        queryBuilder
          .clone()
          .select('question.subject', 'value')
          .addSelect('COUNT(*)', 'count')
          .groupBy('question.subject')
          .orderBy('count', 'DESC')
          .getRawMany(),
      ]);

    const [topicRows, subtopicRows] = await Promise.all([
      queryBuilder
        .clone()
        .andWhere('question.topic IS NOT NULL')
        .andWhere("question.topic != ''")
        .select('question.topic', 'value')
        .addSelect('COUNT(*)', 'count')
        .groupBy('question.topic')
        .orderBy('count', 'DESC')
        .limit(50)
        .getRawMany(),
      queryBuilder
        .clone()
        .andWhere('question.subtopic IS NOT NULL')
        .andWhere("question.subtopic != ''")
        .select('question.subtopic', 'value')
        .addSelect('COUNT(*)', 'count')
        .groupBy('question.subtopic')
        .orderBy('count', 'DESC')
        .limit(50)
        .getRawMany(),
    ]);

    return {
      types: this.mapFacetRows(typeRows),
      difficulties: this.mapFacetRows(difficultyRows),
      cognitiveLevels: this.mapFacetRows(cognitiveRows),
      statuses: this.mapFacetRows(statusRows),
      grades: this.mapFacetRows(gradeRows),
      subjects: this.mapFacetRows(subjectRows),
      topics: this.mapFacetRows(topicRows),
      subtopics: this.mapFacetRows(subtopicRows),
    };
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
      order: { difficulty: 'ASC', createdAt: 'DESC', id: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateQuestionDto): Promise<Question> {
    const question = await this.findById(id);
    const nextQuestion = {
      ...question,
      ...dto,
      answerData: dto.options ? dto.options : dto.answerData ?? question.answerData,
    } as Question;

    this.validateQuestionPayload(nextQuestion);

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
      order: { createdAt: 'DESC', id: 'DESC' },
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

  private validateQuestionPayload(question: Pick<Question, 'type' | 'questionAr' | 'questionEn' | 'grade' | 'subject'> &
    Partial<Pick<Question, 'answerData' | 'correctAnswer' | 'correctOrder'>>): void {
    if (!question.questionAr?.trim() && !question.questionEn?.trim()) {
      throw new BadRequestException('Question text is required');
    }

    if (!question.grade?.trim()) {
      throw new BadRequestException('Question grade is required');
    }

    if (!question.subject?.trim()) {
      throw new BadRequestException('Question subject is required');
    }

    switch (question.type) {
      case QuestionType.MCQ:
        this.validateMcqAnswerData(question.answerData, false);
        break;
      case QuestionType.MCQ_MULTI:
        this.validateMcqAnswerData(question.answerData, true);
        break;
      case QuestionType.TRUE_FALSE:
        if (typeof question.correctAnswer !== 'boolean') {
          throw new BadRequestException('True/false questions require a correctAnswer boolean');
        }
        break;
      case QuestionType.FILL_BLANK:
        this.validateFillBlankAnswerData(question.answerData);
        break;
      case QuestionType.MATCHING:
        this.validateMatchingAnswerData(question.answerData);
        break;
      case QuestionType.ORDERING:
        if (!Array.isArray(question.correctOrder) || question.correctOrder.length < 2) {
          throw new BadRequestException('Ordering questions require at least two ordered items');
        }
        break;
      case QuestionType.SHORT_ANSWER:
      case QuestionType.ESSAY:
        break;
      default:
        throw new BadRequestException('Unsupported question type');
    }
  }

  private validateMcqAnswerData(answerData: Question['answerData'] | undefined, allowMultiple: boolean): void {
    if (!Array.isArray(answerData) || answerData.length < 2) {
      throw new BadRequestException('Multiple choice questions require at least two options');
    }

    const options = answerData as MCQOption[];
    const correctCount = options.filter(option => option.isCorrect).length;
    const hasEmptyOption = options.some(
      option => !String(option.textAr || option.textEn || '').trim(),
    );

    if (hasEmptyOption) {
      throw new BadRequestException('Multiple choice options cannot be empty');
    }

    if (allowMultiple) {
      if (correctCount < 1) {
        throw new BadRequestException('Multi-select questions require at least one correct option');
      }
      return;
    }

    if (correctCount !== 1) {
      throw new BadRequestException('Single choice questions require exactly one correct option');
    }
  }

  private validateFillBlankAnswerData(answerData: Question['answerData'] | undefined): void {
    if (!Array.isArray(answerData) || answerData.length < 1) {
      throw new BadRequestException('Fill blank questions require at least one blank answer');
    }

    const blanks = answerData as BlankAnswer[];
    const invalidBlank = blanks.some(
      blank =>
        typeof blank.position !== 'number' ||
        !Array.isArray(blank.acceptedAnswers) ||
        blank.acceptedAnswers.every(answer => !String(answer).trim()),
    );

    if (invalidBlank) {
      throw new BadRequestException('Each blank must include a position and accepted answers');
    }
  }

  private validateMatchingAnswerData(answerData: Question['answerData'] | undefined): void {
    if (!Array.isArray(answerData) || answerData.length < 2) {
      throw new BadRequestException('Matching questions require at least two pairs');
    }

    const pairs = answerData as MatchingPair[];
    const invalidPair = pairs.some(
      pair =>
        !String(pair.id || '').trim() ||
        !String(pair.leftAr || pair.leftEn || '').trim() ||
        !String(pair.rightAr || pair.rightEn || '').trim(),
    );

    if (invalidPair) {
      throw new BadRequestException('Each matching pair must include left and right values');
    }
  }

  private buildFindAllQuery(query: QuestionQueryDto): SelectQueryBuilder<Question> {
    const queryBuilder = this.questionRepository.createQueryBuilder('question');

    if (query.type) queryBuilder.andWhere('question.type = :type', { type: query.type });
    if (query.difficulty) {
      queryBuilder.andWhere('question.difficulty = :difficulty', {
        difficulty: query.difficulty,
      });
    }
    if (query.cognitiveLevel) {
      queryBuilder.andWhere('question.cognitiveLevel = :cognitiveLevel', {
        cognitiveLevel: query.cognitiveLevel,
      });
    }
    if (query.categoryId) {
      queryBuilder.andWhere('question.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.grade) queryBuilder.andWhere('question.grade = :grade', { grade: query.grade });
    if (query.subject) {
      queryBuilder.andWhere('question.subject = :subject', { subject: query.subject });
    }
    if (query.topic) queryBuilder.andWhere('question.topic = :topic', { topic: query.topic });
    if (query.subtopic) {
      queryBuilder.andWhere('question.subtopic = :subtopic', { subtopic: query.subtopic });
    }
    if (query.status) {
      queryBuilder.andWhere('question.status = :status', { status: query.status });
    }
    if (query.createdBy) {
      queryBuilder.andWhere('question.createdBy = :createdBy', {
        createdBy: query.createdBy,
      });
    }

    if (query.tags?.length) {
      query.tags.forEach((tag, index) => {
        queryBuilder.andWhere(`question.tags ILIKE :tag${index}`, {
          [`tag${index}`]: `%${tag}%`,
        });
      });
    }

    if (query.search) {
      const searchTerm = `%${query.search.trim()}%`;
      queryBuilder.andWhere(
        `(
          question.questionAr ILIKE :search
          OR question.questionEn ILIKE :search
          OR question.topic ILIKE :search
          OR question.subtopic ILIKE :search
        )`,
        { search: searchTerm },
      );
    }

    if (query.minCorrectRate !== undefined) {
      queryBuilder.andWhere('question.correctRate >= :minCorrectRate', {
        minCorrectRate: query.minCorrectRate,
      });
    }

    if (query.minUsageCount !== undefined) {
      queryBuilder.andWhere('question.usageCount >= :minUsageCount', {
        minUsageCount: query.minUsageCount,
      });
    }

    return queryBuilder;
  }

  private mapFacetRows(rows: Array<{ value: string; count: string | number }>): Array<{
    value: string;
    count: number;
  }> {
    return rows
      .filter(row => row.value !== null && row.value !== undefined && row.value !== '')
      .map(row => ({
        value: String(row.value),
        count: Number(row.count),
      }));
  }
}
