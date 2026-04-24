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
import { SessionsService } from '../services/sessions.service';
import { CreateSessionDto, UpdateSessionDto, SessionQueryDto, RateSessionDto } from '../dto';
import { LiveSession, SessionAttendee } from '../entities';
import {
  createSuccessResponse,
  createPaginatedResponse,
  ApiResponse,
  PaginatedResponse,
} from '../../../common/dto';
import { JwtAuthGuard, RbacGuard, Roles, Permissions, CurrentUser, JwtPayload } from '../../auth';
import { Role, Permission } from '../../auth/constants/roles.constant';

@Controller('sessions')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  // Teachers can create sessions
  @Post()
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.SESSION_CREATE)
  async create(
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<LiveSession>> {
    const session = await this.sessionsService.create(dto, user.sub);
    return createSuccessResponse(session, 'Session created successfully');
  }

  @Get()
  async findAll(
    @Query() query: SessionQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedResponse<LiveSession>> {
    const { sessions, total } = await this.sessionsService.findAll(query, query, user.sub);
    return createPaginatedResponse(sessions, query.page || 1, query.pageSize || 20, total);
  }

  @Get('upcoming')
  async findUpcoming(
    @Query('grade') grade: string,
    @Query('subject') subject: string,
  ): Promise<ApiResponse<LiveSession[]>> {
    const sessions = await this.sessionsService.findUpcoming(grade, subject);
    return createSuccessResponse(sessions);
  }

  @Get('my')
  async getMySessions(
    @CurrentUser() user: JwtPayload,
    @Query('upcoming') upcoming?: string,
  ): Promise<ApiResponse<LiveSession[]>> {
    const sessions = await this.sessionsService.getUserSessions(user.sub, upcoming !== 'false');
    return createSuccessResponse(sessions);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<LiveSession>> {
    const session = await this.sessionsService.findById(id, user.sub, user.role);
    return createSuccessResponse(session);
  }

  @Put(':id')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<LiveSession>> {
    const session = await this.sessionsService.update(id, dto, user.sub);
    return createSuccessResponse(session, 'Session updated successfully');
  }

  @Patch(':id/cancel')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<LiveSession>> {
    const session = await this.sessionsService.cancel(id, user.sub);
    return createSuccessResponse(session, 'Session cancelled');
  }

  @Post(':id/start')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<LiveSession>> {
    const session = await this.sessionsService.startSession(id, user.sub);
    return createSuccessResponse(session, 'Session started');
  }

  @Patch(':id/end')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async endSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<LiveSession>> {
    const session = await this.sessionsService.endSession(id, user.sub);
    return createSuccessResponse(session, 'Session ended');
  }

  // ==================== Attendee Endpoints ====================

  @Post(':id/register')
  async register(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<SessionAttendee>> {
    const attendee = await this.sessionsService.registerAttendee(id, user.sub);
    return createSuccessResponse(attendee, 'Registered successfully');
  }

  @Delete(':id/register')
  async unregister(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<null>> {
    await this.sessionsService.unregister(id, user.sub);
    return createSuccessResponse(null, 'Unregistered successfully');
  }

  @Get(':id/join-link')
  async getJoinLink(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<{ roomName: string; domain: string; joinToken: string; config: any }>> {
    const result = await this.sessionsService.getJoinLink(id, user.sub);
    return createSuccessResponse(result);
  }

  @Post(':id/join')
  async recordJoin(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<null>> {
    await this.sessionsService.recordJoin(id, user.sub);
    return createSuccessResponse(null, 'Join recorded');
  }

  @Post(':id/leave')
  async recordLeave(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<null>> {
    await this.sessionsService.recordLeave(id, user.sub);
    return createSuccessResponse(null, 'Leave recorded');
  }

  @Post(':id/rate')
  async rateSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RateSessionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<null>> {
    await this.sessionsService.rateSession(id, user.sub, dto);
    return createSuccessResponse(null, 'Rating submitted');
  }

  @Post(':id/regenerate-room')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  async regenerateRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<{ roomName: string }>> {
    const result = await this.sessionsService.regenerateRoomName(id, user.sub);
    return createSuccessResponse(result, 'Room name regenerated');
  }
}
