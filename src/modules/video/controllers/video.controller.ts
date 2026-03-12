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
    Headers,
    RawBodyRequest,
    Req,
    ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
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
import { JwtAuthGuard, RbacGuard, Roles, Permissions, CurrentUser, JwtPayload, Public } from '../../auth';
import { Role, Permission } from '../../auth/constants/roles.constant';

@Controller('videos')
@UseGuards(JwtAuthGuard, RbacGuard)
export class VideoController {
    constructor(
        private readonly videoService: VideoService,
        private readonly configService: ConfigService,
    ) { }

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
    ): Promise<ApiResponse<{ uploadUrl: string; signature: string; expires: number }>> {
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
        @Req() req: RawBodyRequest<Request>,
        @Headers('x-bunny-signature') signature: string,
    ): Promise<ApiResponse<null>> {
        const rawBody = req.rawBody?.toString() || '';

        // Validate Bunny webhook signature
        const signingKey = this.configService.get<string>('bunny.signingKey');
        if (!signingKey) {
            throw new ForbiddenException('Webhook signing key not configured');
        }

        if (!signature) {
            throw new ForbiddenException('Missing webhook signature');
        }

        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', signingKey)
            .update(rawBody)
            .digest('hex');

        // Use timing-safe comparison to prevent timing attacks
        if (
            signature.length !== expectedSignature.length ||
            !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
        ) {
            throw new ForbiddenException('Invalid webhook signature');
        }

        const payload = JSON.parse(rawBody || '{}');
        await this.videoService.handleBunnyWebhook(payload);

        return createSuccessResponse(null, 'Webhook processed');
    }
}
