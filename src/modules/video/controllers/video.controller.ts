import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
  Res,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { VideoService } from '../services/video.service';
import {
  CreateVideoDto,
  UpdateVideoDto,
  UpdateProgressDto,
  VideoQueryDto,
  SignedVideoUrl,
  VideoProgress,
} from '../dto';
import { Video } from '../entities';
import {
  PaginationQueryDto,
  createSuccessResponse,
  createPaginatedResponse,
  ApiResponse,
  PaginatedResponse,
} from '../../../common/dto';
import {
  JwtAuthGuard,
  RbacGuard,
  Roles,
  Permissions,
  CurrentUser,
  JwtPayload,
  Public,
} from '../../auth';
import { Role, Permission } from '../../auth/constants/roles.constant';
import { BunnyMigrationService } from '../../../bunny/bunny-migration.service';

@Controller('videos')
@UseGuards(JwtAuthGuard, RbacGuard)
export class VideoController {
  private readonly logger = new Logger(VideoController.name);

  constructor(
    private readonly videoService: VideoService,
    private readonly bunnyMigrationService: BunnyMigrationService,
  ) {}

  // Admin creates video entry
  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.CONTENT_WRITE)
  async create(
    @Body() dto: CreateVideoDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<Video>> {
    const video = await this.videoService.create(dto, user.sub);
    return createSuccessResponse(video, 'Video created successfully');
  }

  // Get upload credentials for a video
  @Get(':id/upload-credentials')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getUploadCredentials(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<{ uploadUrl: string; signature: string; expires: number }>> {
    res.setHeader('Deprecation', 'true');
    res.setHeader(
      'Warning',
      '299 - "Deprecated endpoint: use unified Bunny upload credentials endpoint"',
    );
    this.logger.warn(`Deprecated endpoint called: GET /videos/${id}/upload-credentials`);

    const credentials = await this.videoService.getUploadCredentials(id, user.sub);
    return createSuccessResponse(credentials);
  }

  @Get()
  async findAll(
    @Query() query: VideoQueryDto,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<Video>> {
    const { videos, total } = await this.videoService.findAll(query, pagination);
    return createPaginatedResponse(videos, pagination.page || 1, pagination.pageSize || 20, total);
  }

  @Get('lesson/:lessonId')
  async findByLesson(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ): Promise<ApiResponse<Video[]>> {
    const videos = await this.videoService.findByLesson(lessonId);
    return createSuccessResponse(videos);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<Video>> {
    const video = await this.videoService.findById(id);
    return createSuccessResponse(video);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Permissions(Permission.CONTENT_WRITE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVideoDto,
  ): Promise<ApiResponse<Video>> {
    const video = await this.videoService.update(id, dto);
    return createSuccessResponse(video, 'Video updated successfully');
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<null>> {
    await this.videoService.delete(id);
    return createSuccessResponse(null, 'Video deleted successfully');
  }

  // ==================== Playback ====================

  @Get(':id/play')
  async getPlaybackUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<SignedVideoUrl>> {
    const signedUrl = await this.videoService.getSignedPlaybackUrl(id, user.sub);
    return createSuccessResponse(signedUrl);
  }

  // ==================== Progress ====================

  @Get(':id/progress')
  async getProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<VideoProgress>> {
    const progress = await this.videoService.getProgress(id, user.sub);
    return createSuccessResponse(progress);
  }

  @Post(':id/progress')
  async updateProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProgressDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<VideoProgress>> {
    const progress = await this.videoService.updateProgress(id, user.sub, dto);
    return createSuccessResponse(progress);
  }

  @Post('progress/batch')
  async getMultiProgress(
    @Body() body: { videoIds: string[] },
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<VideoProgress[]>> {
    const progress = await this.videoService.getUserVideoProgress(user.sub, body.videoIds);
    return createSuccessResponse(progress);
  }

  // ==================== Webhook ====================

  @Post('webhook/bunny')
  @Public()
  async handleBunnyWebhook(
    @Body()
    payload: {
      VideoGuid: string;
      Status: number;
      VideoLibraryId: number;
      VideoLength?: number;
      AvailableResolutions?: string;
      SecurityToken?: string;
    },
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<null>> {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Warning', '299 - "Deprecated endpoint: use consolidated webhook endpoint"');
    this.logger.warn('Deprecated endpoint called: POST /videos/webhook/bunny');

    const verification = this.bunnyMigrationService.verifyWebhookWithFallback({
      payload,
      headerSignature: payload.SecurityToken,
      enforceStrict: true,
      routeKey: `video:webhook:${payload.VideoGuid}`,
    });

    if (!verification.valid) {
      throw new ForbiddenException(verification.reason || 'Invalid webhook signature');
    }

    await this.videoService.handleBunnyWebhook(payload);
    return createSuccessResponse(null, 'Webhook processed');
  }
}
