import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { QuestionBankService } from '../services/question-bank.service';
import { CreateQuestionDto, UpdateQuestionDto, ReviewQuestionDto, QuestionQueryDto } from '../dto';
import { Question } from '../entities';
import {
  PaginationQueryDto,
  createSuccessResponse,
  createPaginatedResponse,
  ApiResponse,
  PaginatedResponse,
} from '../../../common/dto';
import { JwtAuthGuard, RbacGuard, Roles, Permissions, CurrentUser, JwtPayload } from '../../auth';
import { Role, Permission } from '../../auth/constants/roles.constant';

@Controller('questions')
@UseGuards(JwtAuthGuard, RbacGuard)
export class QuestionsController {
  constructor(private readonly questionBankService: QuestionBankService) {}

  private async enforceQuestionWriteAccess(id: string, user: JwtPayload): Promise<void> {
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      return;
    }

    const question = await this.questionBankService.findById(id);
    if (question.createdBy !== user.sub) {
      throw new ForbiddenException('You can only modify your own questions');
    }
  }

  // Teachers and above can create questions
  @Post()
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.QUESTION_CONTRIBUTE)
  async create(
    @Body() dto: CreateQuestionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<Question>> {
    const question = await this.questionBankService.create(dto, user.sub);
    return createSuccessResponse(question, 'Question created successfully');
  }

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async findAll(@Query() query: QuestionQueryDto): Promise<PaginatedResponse<Question>> {
    const { questions, total } = await this.questionBankService.findAll(query, query);
    return createPaginatedResponse(questions, query.page || 1, query.pageSize || 100, total);
  }

  @Get('my')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async findMyQuestions(
    @CurrentUser() user: JwtPayload,
    @Query() query: QuestionQueryDto,
  ): Promise<PaginatedResponse<Question>> {
    const myQuestionsQuery = Object.assign(new QuestionQueryDto(), query, {
      createdBy: user.sub,
    });

    const { questions, total } = await this.questionBankService.findAll(
      myQuestionsQuery,
      myQuestionsQuery,
    );
    return createPaginatedResponse(
      questions,
      query.page || 1,
      query.pageSize || 100,
      total,
    );
  }

  @Get('pending-review')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.QUESTION_REVIEW)
  async getPendingReview(
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<Question>> {
    const { questions, total } =
      await this.questionBankService.getPendingReviewQuestions(pagination);
    return createPaginatedResponse(
      questions,
      pagination.page || 1,
      pagination.pageSize || 20,
      total,
    );
  }

  @Get('facets')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async getFacets(
    @Query() query: QuestionQueryDto,
  ): Promise<ApiResponse<Record<string, Array<{ value: string; count: number }>>>> {
    const facets = await this.questionBankService.getFacetCounts(query);
    return createSuccessResponse(facets);
  }

  @Get(':id')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Question>> {
    const question = await this.questionBankService.findById(id);
    return createSuccessResponse(question);
  }

  @Put(':id')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<Question>> {
    await this.enforceQuestionWriteAccess(id, user);
    const question = await this.questionBankService.update(id, dto);
    return createSuccessResponse(question, 'Question updated successfully');
  }

  @Patch(':id/submit-review')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async submitForReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<Question>> {
    await this.enforceQuestionWriteAccess(id, user);
    const question = await this.questionBankService.submitForReview(id);
    return createSuccessResponse(question, 'Question submitted for review');
  }

  @Patch(':id/review')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.QUESTION_APPROVE)
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewQuestionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<Question>> {
    const question = await this.questionBankService.review(id, dto, user.sub);
    return createSuccessResponse(question, `Question ${dto.status}`);
  }

  @Patch(':id/archive')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async archive(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Question>> {
    const question = await this.questionBankService.archive(id);
    return createSuccessResponse(question, 'Question archived');
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<null>> {
    await this.enforceQuestionWriteAccess(id, user);
    await this.questionBankService.delete(id);
    return createSuccessResponse(null, 'Question deleted successfully');
  }
}
