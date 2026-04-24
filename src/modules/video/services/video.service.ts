import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Video, VideoStatus } from '../entities/video.entity';
import { VideoWatchProgress } from '../entities/video-watch-progress.entity';
import { BunnyNetService } from './bunny-net.service';
import {
  CreateVideoDto,
  UpdateVideoDto,
  UpdateProgressDto,
  VideoQueryDto,
  SignedVideoUrl,
  VideoProgress,
} from '../dto';
import { PaginationQueryDto } from '../../../common/dto';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { BunnyMigrationService } from '../../../bunny/bunny-migration.service';

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    @InjectRepository(VideoWatchProgress)
    private readonly progressRepository: Repository<VideoWatchProgress>,
    private readonly bunnyNetService: BunnyNetService,
    private readonly bunnyMigrationService: BunnyMigrationService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async create(dto: CreateVideoDto, uploadedBy: string): Promise<Video> {
    // Create video credentials using migration layer (canary + fallback).
    const bunnyCredentials = await this.bunnyMigrationService.createVideoWithFallback({
      title: dto.titleEn,
      routeKey: `video:create:${uploadedBy}:${dto.titleEn}`,
    });

    const video = this.videoRepository.create({
      ...dto,
      uploadedBy,
      status: VideoStatus.PENDING,
      bunnyVideoId: bunnyCredentials.videoId,
      bunnyLibraryId: bunnyCredentials.libraryId,
    });

    await this.videoRepository.save(video);

    this.logger.log(`Video created: ${video.id} (Bunny: ${bunnyCredentials.videoId})`);
    return video;
  }

  async getUploadCredentials(
    id: string,
    userId: string,
  ): Promise<{
    uploadUrl: string;
    signature: string;
    expires: number;
  }> {
    const video = await this.findById(id);

    if (video.uploadedBy !== userId) {
      throw new ForbiddenException('Not authorized to upload this video');
    }

    const credentials = await this.bunnyMigrationService.getCredentialsWithFallback({
      title: video.titleEn,
      videoId: video.bunnyVideoId,
      routeKey: `video:upload-credentials:${id}:${userId}`,
    });

    return {
      uploadUrl: credentials.uploadUrl,
      signature: credentials.authorizationSignature,
      expires: credentials.authorizationExpire,
    };
  }

  async findAll(
    query: VideoQueryDto,
    pagination: PaginationQueryDto,
  ): Promise<{ videos: Video[]; total: number }> {
    const where: FindOptionsWhere<Video> = {
      status: VideoStatus.READY,
    };

    if (query.grade) where.grade = query.grade;
    if (query.subject) where.subject = query.subject;
    if (query.lessonId) where.lessonId = query.lessonId;

    const [videos, total] = await this.videoRepository.findAndCount({
      where,
      skip: pagination.skip,
      take: pagination.take,
      order: { createdAt: 'DESC' },
    });

    return { videos, total };
  }

  async findById(id: string): Promise<Video> {
    const video = await this.videoRepository.findOne({ where: { id } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }
    return video;
  }

  async findByLesson(lessonId: string): Promise<Video[]> {
    return this.videoRepository.find({
      where: { lessonId, status: VideoStatus.READY },
      order: { createdAt: 'ASC' },
    });
  }

  async update(id: string, dto: UpdateVideoDto): Promise<Video> {
    const video = await this.findById(id);
    Object.assign(video, dto);
    await this.videoRepository.save(video);
    return video;
  }

  async delete(id: string): Promise<void> {
    const video = await this.findById(id);

    // Delete from Bunny.net
    await this.bunnyNetService.deleteVideo(video.bunnyVideoId);

    // Mark as deleted (soft delete)
    video.status = VideoStatus.DELETED;
    await this.videoRepository.save(video);

    this.logger.log(`Video deleted: ${id}`);
  }

  // ==================== Streaming ====================

  async getSignedPlaybackUrl(id: string, userId: string): Promise<SignedVideoUrl> {
    const video = await this.findById(id);

    if (video.status !== VideoStatus.READY) {
      throw new ForbiddenException('Video is not available for playback');
    }

    // Check access
    if (video.requiresAuth && !userId) {
      throw new ForbiddenException('Authentication required');
    }

    if (video.requiresSubscription) {
      // Verify subscription from database — check all grades since video may not be grade-specific
      const userSubs = await this.subscriptionsService.findUserSubscriptions(userId);
      const hasActiveSub = userSubs.some(s => s.status === 'active');
      if (!hasActiveSub) {
        throw new ForbiddenException('Subscription required to watch this video');
      }
    }

    // Generate signed URL
    const signedUrl = this.bunnyMigrationService.generateSignedUrlWithFallback(
      video.bunnyVideoId,
      video.tokenExpirationSeconds,
      userId,
      `video:play:${id}:${userId}`,
    );

    // Update view count
    video.viewCount += 1;
    await this.videoRepository.save(video);

    return {
      videoId: id,
      playlistUrl: signedUrl.playlistUrl,
      thumbnailUrl: signedUrl.thumbnailUrl,
      expiresAt: signedUrl.expiresAt,
      token: signedUrl.token,
    };
  }

  // ==================== Progress Tracking ====================

  async getProgress(videoId: string, userId: string): Promise<VideoProgress> {
    const progress = await this.progressRepository.findOne({
      where: { videoId, userId },
    });

    if (!progress) {
      return {
        videoId,
        lastPosition: 0,
        completionPercentage: 0,
        isCompleted: false,
      };
    }

    return {
      videoId,
      lastPosition: progress.lastPositionSeconds,
      completionPercentage: Number(progress.completionPercentage),
      isCompleted: progress.isCompleted,
    };
  }

  async updateProgress(
    videoId: string,
    userId: string,
    dto: UpdateProgressDto,
  ): Promise<VideoProgress> {
    const video = await this.findById(videoId);

    let progress = await this.progressRepository.findOne({
      where: { videoId, userId },
    });

    if (!progress) {
      progress = this.progressRepository.create({
        videoId,
        userId,
        watchCount: 1,
      });
    } else {
      progress.watchCount += 1;
    }

    progress.lastPositionSeconds = dto.positionSeconds;
    progress.lastWatchedAt = new Date();

    if (dto.totalWatched) {
      progress.totalWatchedSeconds = Math.max(progress.totalWatchedSeconds, dto.totalWatched);
    }

    if (dto.quality) {
      progress.lastQuality = dto.quality;
    }

    if (dto.playbackSpeed) {
      progress.lastPlaybackSpeed = dto.playbackSpeed;
    }

    // Calculate completion
    if (video.durationSeconds > 0) {
      const percentage = (dto.positionSeconds / video.durationSeconds) * 100;
      progress.completionPercentage = Math.min(100, percentage);

      // Mark as completed if >= 90%
      if (percentage >= 90 && !progress.isCompleted) {
        progress.isCompleted = true;
        progress.completedAt = new Date();
      }
    }

    await this.progressRepository.save(progress);

    // Update video stats
    await this.updateVideoStats(videoId);

    return {
      videoId,
      lastPosition: progress.lastPositionSeconds,
      completionPercentage: Number(progress.completionPercentage),
      isCompleted: progress.isCompleted,
    };
  }

  async getUserVideoProgress(userId: string, videoIds: string[]): Promise<VideoProgress[]> {
    if (videoIds.length === 0) return [];

    const progressRecords = await this.progressRepository
      .createQueryBuilder('progress')
      .where('progress.userId = :userId', { userId })
      .andWhere('progress.videoId IN (:...videoIds)', { videoIds })
      .getMany();

    const progressMap = new Map(progressRecords.map(p => [p.videoId, p]));

    return videoIds.map(videoId => {
      const progress = progressMap.get(videoId);
      return {
        videoId,
        lastPosition: progress?.lastPositionSeconds || 0,
        completionPercentage: Number(progress?.completionPercentage || 0),
        isCompleted: progress?.isCompleted || false,
      };
    });
  }

  // ==================== Webhook Handling ====================

  async handleBunnyWebhook(payload: {
    VideoGuid: string;
    Status: number;
    VideoLength?: number;
    AvailableResolutions?: string;
  }): Promise<void> {
    const video = await this.videoRepository.findOne({
      where: { bunnyVideoId: payload.VideoGuid },
    });

    if (!video) {
      this.logger.warn(`Video not found for Bunny webhook: ${payload.VideoGuid}`);
      return;
    }

    // Update status
    const statusText = this.bunnyNetService.getVideoStatusText(payload.Status);

    if (payload.Status === 4) {
      video.status = VideoStatus.READY;
      video.encodingCompletedAt = new Date();
    } else if (payload.Status === 5 || payload.Status === 6) {
      video.status = VideoStatus.FAILED;
    } else if (payload.Status >= 1 && payload.Status <= 3) {
      video.status = VideoStatus.PROCESSING;
    }

    // Update video info
    if (payload.VideoLength) {
      video.durationSeconds = Math.floor(payload.VideoLength);
    }

    if (payload.AvailableResolutions) {
      video.availableQualities = payload.AvailableResolutions.split(',');
    }

    // Update URLs
    const videoInfo = await this.bunnyNetService.getVideoInfo(video.bunnyVideoId);
    if (videoInfo) {
      video.hlsPlaylistUrl = videoInfo.hlsUrl;
      video.thumbnailUrl = videoInfo.thumbnailUrl;
    }

    await this.videoRepository.save(video);
    this.logger.log(`Video ${video.id} status updated: ${statusText}`);
  }

  private async updateVideoStats(videoId: string): Promise<void> {
    const stats = await this.progressRepository
      .createQueryBuilder('progress')
      .select('COUNT(DISTINCT progress.userId)', 'viewers')
      .addSelect('AVG(progress.completionPercentage)', 'avgCompletion')
      .where('progress.videoId = :videoId', { videoId })
      .getRawOne();

    await this.videoRepository.update(videoId, {
      uniqueViewers: parseInt(stats.viewers) || 0,
      avgWatchPercentage: parseFloat(stats.avgCompletion) || 0,
    });
  }
}
