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
import { AssessmentsService } from '../services/assessments.service';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
  AddQuestionsDto,
  AssessmentQueryDto,
} from '../dto';
import { Assessment } from '../entities';
import {
  PaginationQueryDto,
  createSuccessResponse,
  createPaginatedResponse,
  ApiResponse,
  PaginatedResponse,
} from '../../../common/dto';
import { JwtAuthGuard, RbacGuard, Roles, Permissions, CurrentUser, JwtPayload } from '../../auth';
import { Role, Permission } from '../../auth/constants/roles.constant';

@Controller('assessments')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.ASSESSMENT_WRITE)
  async create(
    @Body() dto: CreateAssessmentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<Assessment>> {
    const assessment = await this.assessmentsService.create(dto, user.sub);
    return createSuccessResponse(assessment, 'Assessment created successfully');
  }

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async findAll(
    @Query() query: AssessmentQueryDto,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<Assessment>> {
    const { assessments, total } = await this.assessmentsService.findAll(query, pagination);
    return createPaginatedResponse(
      assessments,
      pagination.page || 1,
      pagination.pageSize || 20,
      total,
    );
  }

  @Get('published')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async findPublished(
    @Query('grade') grade: string,
    @Query('subject') subject: string,
  ): Promise<ApiResponse<Assessment[]>> {
    const assessments = await this.assessmentsService.findPublished(grade, subject);
    return createSuccessResponse(assessments);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Assessment>> {
    const assessment = await this.assessmentsService.findById(id);
    return createSuccessResponse(assessment);
  }

  @Put(':id')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.ASSESSMENT_WRITE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssessmentDto,
  ): Promise<ApiResponse<Assessment>> {
    const assessment = await this.assessmentsService.update(id, dto);
    return createSuccessResponse(assessment, 'Assessment updated successfully');
  }

  @Post(':id/questions')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.ASSESSMENT_WRITE)
  async addQuestions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddQuestionsDto,
  ): Promise<ApiResponse<null>> {
    await this.assessmentsService.addQuestions(id, dto.questionIds);
    return createSuccessResponse(null, 'Questions added successfully');
  }

  @Delete(':id/questions/:questionId')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.ASSESSMENT_WRITE)
  async removeQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ): Promise<ApiResponse<null>> {
    await this.assessmentsService.removeQuestion(id, questionId);
    return createSuccessResponse(null, 'Question removed successfully');
  }

  @Patch(':id/questions/reorder')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.ASSESSMENT_WRITE)
  async reorderQuestions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { questionIds: string[] },
  ): Promise<ApiResponse<null>> {
    await this.assessmentsService.reorderQuestions(id, dto.questionIds);
    return createSuccessResponse(null, 'Questions reordered successfully');
  }

  @Patch(':id/publish')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.ASSESSMENT_WRITE)
  async publish(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Assessment>> {
    const assessment = await this.assessmentsService.publish(id);
    return createSuccessResponse(assessment, 'Assessment published successfully');
  }

  @Patch(':id/close')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async close(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Assessment>> {
    const assessment = await this.assessmentsService.close(id);
    return createSuccessResponse(assessment, 'Assessment closed');
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<null>> {
    await this.assessmentsService.delete(id);
    return createSuccessResponse(null, 'Assessment deleted successfully');
  }
}
