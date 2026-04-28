import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AttemptService } from '../services/attempt.service';
import { StartAttemptDto, SubmitAnswerDto, AttemptResult } from '../dto';
import { AssessmentAttempt, Question } from '../entities';
import { createSuccessResponse, ApiResponse } from '../../../common/dto';
import { JwtAuthGuard, RbacGuard, Roles, CurrentUser, JwtPayload } from '../../auth';
import { Role } from '../../auth/constants/roles.constant';

@Controller('attempts')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AttemptsController {
  constructor(private readonly attemptService: AttemptService) {}

  @Post('start')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async startAttempt(
    @Body() dto: StartAttemptDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponse<AssessmentAttempt>> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    const attempt = await this.attemptService.startAttempt(dto, user.sub, ipAddress, userAgent);
    return createSuccessResponse(attempt, 'Attempt started');
  }

  @Get(':id')
  async getAttempt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<{ attempt: AssessmentAttempt; questions: Array<Partial<Question>> }>> {
    const result = await this.attemptService.getAttemptWithQuestions(id, user.sub);
    return createSuccessResponse(result);
  }

  @Post(':id/answers')
  async saveAnswer(
    @Param('id', ParseUUIDPipe) attemptId: string,
    @Body() dto: SubmitAnswerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<null>> {
    await this.attemptService.saveAnswer(attemptId, dto, user.sub);
    return createSuccessResponse(null, 'Answer saved');
  }

  @Post(':id/submit')
  async submitAttempt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<AttemptResult>> {
    const result = await this.attemptService.submitAttempt(id, user.sub);
    return createSuccessResponse(result, 'Attempt submitted');
  }

  @Get(':id/result')
  async getResult(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<AttemptResult>> {
    const result = await this.attemptService.getAttemptResult(id, user.sub);
    return createSuccessResponse(result);
  }

  @Get('my/history')
  async getMyAttempts(
    @CurrentUser() user: JwtPayload,
    @Query('assessmentId') assessmentId?: string,
  ): Promise<ApiResponse<AssessmentAttempt[]>> {
    const attempts = await this.attemptService.getUserAttempts(user.sub, assessmentId);
    return createSuccessResponse(attempts);
  }

  @Get('assessment/:id')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async getAssessmentAttempts(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<AssessmentAttempt[]>> {
    const attempts = await this.attemptService.getAttemptsByAssessment(id);
    return createSuccessResponse(attempts);
  }
}
