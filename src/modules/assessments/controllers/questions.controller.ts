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
} from '@nestjs/common';
import { QuestionBankService } from '../services/question-bank.service';
import { CreateQuestionDto, UpdateQuestionDto, ReviewQuestionDto, QuestionQueryDto, ReorderQuestionsDto, QuestionAnalyticsQueryDto } from '../dto';
import { Question } from '../entities';
import {
  PaginationQueryDto,
  createSuccessResponse,
  createPaginatedResponse,
  ApiResponse,
  PaginatedResponse,
} from '../../../common/dto';
import { JwtAuthGuard, RbacGuard, Roles, CurrentUser, JwtPayload } from '../../auth';
import { Role } from '../../auth/constants/roles.constant';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';

@Controller('questions')
@UseGuards(JwtAuthGuard, RbacGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class QuestionsController {
  constructor(private readonly questionBankService: QuestionBankService) {}

  // Question bank is centrally controlled by authorized admins only.
  @Post()
  @RequirePermissions({ action: 'manage', resource: 'questions' })
  async create(
    @Body() dto: CreateQuestionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<Question>> {
    const question = await this.questionBankService.create(dto, user.sub);
    return createSuccessResponse(question, 'Question created successfully');
  }

  @Patch('reorder')
  @RequirePermissions({ action: 'manage', resource: 'questions' })
  async reorder(@Body() dto: ReorderQuestionsDto): Promise<ApiResponse<null>> {
    await this.questionBankService.reorderQuestions(dto.items);
    return createSuccessResponse(null, 'Questions reordered');
  }

  @Get('analytics')
  @RequirePermissions({ action: 'view', resource: 'questions' })
  async getAnalytics(@Query() query: QuestionAnalyticsQueryDto): Promise<ApiResponse<any>> {
    const analytics = await this.questionBankService.getAnalytics(query);
    return createSuccessResponse(analytics);
  }

  @Get('types')
  @RequirePermissions({ action: 'view', resource: 'questions' })
  async getQuestionTypes(): Promise<ApiResponse<any>> {
    const types = this.questionBankService.getQuestionTypeSpecs();
    return createSuccessResponse(types);
  }

  @Get()
  @RequirePermissions({ action: 'view', resource: 'questions' })
  async findAll(@Query() query: QuestionQueryDto): Promise<PaginatedResponse<Question>> {
    const { questions, total } = await this.questionBankService.findAll(query, query);
    return createPaginatedResponse(questions, query.page || 1, query.pageSize || 100, total);
  }

  @Get('my')
  @RequirePermissions({ action: 'view', resource: 'questions' })
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
  @RequirePermissions({ action: 'manage', resource: 'questions' })
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
  @RequirePermissions({ action: 'view', resource: 'questions' })
  async getFacets(
    @Query() query: QuestionQueryDto,
  ): Promise<ApiResponse<Record<string, Array<{ value: string; count: number }>>>> {
    const facets = await this.questionBankService.getFacetCounts(query);
    return createSuccessResponse(facets);
  }

  @Get(':id')
  @RequirePermissions({ action: 'view', resource: 'questions' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Question>> {
    const question = await this.questionBankService.findById(id);
    return createSuccessResponse(question);
  }

  @Put(':id')
  @RequirePermissions({ action: 'manage', resource: 'questions' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionDto,
  ): Promise<ApiResponse<Question>> {
    const question = await this.questionBankService.update(id, dto);
    return createSuccessResponse(question, 'Question updated successfully');
  }

  @Patch(':id/submit-review')
  @RequirePermissions({ action: 'manage', resource: 'questions' })
  async submitForReview(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<Question>> {
    const question = await this.questionBankService.submitForReview(id);
    return createSuccessResponse(question, 'Question submitted for review');
  }

  @Patch(':id/review')
  @RequirePermissions({ action: 'manage', resource: 'questions' })
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewQuestionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<Question>> {
    const question = await this.questionBankService.review(id, dto, user.sub);
    return createSuccessResponse(question, `Question ${dto.status}`);
  }

  @Patch(':id/archive')
  @RequirePermissions({ action: 'manage', resource: 'questions' })
  async archive(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Question>> {
    const question = await this.questionBankService.archive(id);
    return createSuccessResponse(question, 'Question archived');
  }

  @Delete(':id')
  @RequirePermissions({ action: 'manage', resource: 'questions' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<null>> {
    await this.questionBankService.delete(id);
    return createSuccessResponse(null, 'Question deleted successfully');
  }
}
