import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import bunnyConfig from '../../config/bunny.config';
import { VideoResource, VideoStatus } from '../content/entities/video-resource.entity';
import { Lesson } from '../content/entities/lesson.entity';
import { Module as ContentModule } from '../content/entities/module.entity';
import { Course } from '../content/entities/course.entity';

@Injectable()
export class BunnyNetService {
  private readonly logger = new Logger(BunnyNetService.name);
  private readonly baseUrl = 'https://video.bunnycdn.com';

  constructor(
    @Inject(bunnyConfig.KEY)
    private config: ConfigType<typeof bunnyConfig>,
    @InjectRepository(VideoResource)
    private readonly videoRepository: Repository<VideoResource>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(ContentModule)
    private readonly moduleRepository: Repository<ContentModule>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
  ) {}

  /**
   * Create a video object in Bunny.net to prepare for upload
   */
  async createVideo(title: string): Promise<{
    videoId: string;
    libraryId: string;
    uploadSignature: string;
    authorizationSignature: string;
    expirationTime: number;
  }> {
    try {
      const libraryId = this.config.libraryId;
      const apiKey = this.config.apiKey;

      if (!libraryId || !apiKey) {
        throw new Error('Bunny.net configuration missing');
      }

      const response = await axios.post(
        `${this.baseUrl}/library/${libraryId}/videos`,
        { title },
        { headers: { AccessKey: apiKey } },
      );

      const videoId = response.data.guid;

      // Generate signatures for frontend direct upload (TUS)
      const expirationTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours — safe for slow connections and large files (up to 11GB)
      const uploadSignature = this.generateSignature(libraryId, videoId, expirationTime);

      this.logger.debug(
        `Generated TUS credentials for ${videoId}: library=${libraryId}, expire=${expirationTime}, sig=${uploadSignature.substring(0, 8)}...`,
      );

      // Also create the VideoResource in our DB immediately
      const video = this.videoRepository.create({
        title,
        bunnyVideoId: videoId,
        libraryId,
        status: VideoStatus.PENDING,
      });
      await this.videoRepository.save(video);

      return {
        videoId,
        libraryId,
        uploadSignature,
        authorizationSignature: uploadSignature,
        expirationTime,
      };
    } catch (error) {
      this.logger.error('Failed to create video in Bunny.net', error);
      throw error;
    }
  }

  /**
   * Generate fresh TUS credentials for an already-created Bunny video.
   * Useful when a stale resumable-upload session returns 404 and the client
   * needs a new signed upload authorization for the same video object.
   */
  async getUploadCredentials(videoId: string): Promise<{
    videoId: string;
    libraryId: string;
    uploadSignature: string;
    authorizationSignature: string;
    expirationTime: number;
  }> {
    const normalizedVideoId = videoId?.trim();
    if (!normalizedVideoId) {
      throw new Error('Bunny video id is required');
    }

    const libraryId = this.config.libraryId;
    const apiKey = this.config.apiKey;

    if (!libraryId || !apiKey) {
      throw new Error('Bunny.net configuration missing');
    }

    try {
      await axios.get(`${this.baseUrl}/library/${libraryId}/videos/${normalizedVideoId}`, {
        headers: { AccessKey: apiKey },
      });
    } catch (error: any) {
      if (error?.response?.status === 404) {
        throw new Error(`Bunny video not found: ${normalizedVideoId}`);
      }
      throw error;
    }

    const expirationTime = Math.floor(Date.now() / 1000) + 86400;
    const uploadSignature = this.generateSignature(libraryId, normalizedVideoId, expirationTime);

    this.logger.debug(
      `Refreshed TUS credentials for ${normalizedVideoId}: library=${libraryId}, expire=${expirationTime}, sig=${uploadSignature.substring(0, 8)}...`,
    );

    return {
      videoId: normalizedVideoId,
      libraryId,
      uploadSignature,
      authorizationSignature: uploadSignature,
      expirationTime,
    };
  }

  /**
   * Get the configured library ID (safe for frontend use)
   */
  getLibraryId(): string {
    return this.config.libraryId || '';
  }

  /**
   * Generate SHA256 signature for secure upload
   */
  private generateSignature(libraryId: string, videoId: string, expirationTime: number): string {
    const stringToSign = `${libraryId}${this.config.apiKey}${expirationTime}${videoId}`;
    return crypto.createHash('sha256').update(stringToSign).digest('hex');
  }

  /**
   * Generate a signed URL for secure playback
   * Token Security must be enabled in Bunny.net
   */
  generateSignedUrl(videoId: string, expiresInSeconds = 3600): string {
    const securityKey = this.config.signingKey;
    if (!securityKey) {
      this.logger.warn('No signing key configured for Bunny.net');
      return '';
    }

    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const tokenContent = `${securityKey}${videoId}${expires}`;
    const token = crypto.createHash('sha256').update(tokenContent).digest('hex');

    return token;
  }

  /**
   * Verify incoming webhook signature
   */
  verifyWebhookSignature(payload: unknown, signature: string): boolean {
    if (!this.config.signingKey) {
      this.logger.warn('No signing key configured — webhook signature verification skipped');
      return true;
    }

    if (!signature) {
      this.logger.warn('No signature provided in webhook request');
      return false;
    }

    // Bunny.net webhook signature: SHA256(LibraryId + ApiKey + RequestBody)
    const libraryId = this.config.libraryId ?? '';
    const apiKey = this.config.apiKey ?? '';
    const payloadText = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    const expectedSignature = crypto
      .createHash('sha256')
      .update(libraryId + apiKey + payloadText)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }

  private mapWebhookStatus(statusCode: number): VideoStatus {
    if (statusCode === 4 || statusCode === 3) {
      return VideoStatus.READY;
    }

    if (statusCode === 5 || statusCode === 6) {
      return VideoStatus.FAILED;
    }

    if (statusCode === 2) {
      return VideoStatus.PROCESSING;
    }

    if (statusCode === 1) {
      return VideoStatus.UPLOADING;
    }

    return VideoStatus.PENDING;
  }

  private extractDurationSeconds(payload: any): number {
    const value = payload?.Length ?? payload?.VideoLength ?? payload?.length;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return 0;
    }

    return Math.floor(numericValue);
  }

  private async updateLinkedLessonAndCourseDurations(video: VideoResource): Promise<void> {
    if (!video.id || video.durationSeconds <= 0) {
      return;
    }

    const lesson = await this.lessonRepository.findOne({
      where: { videoResourceId: video.id },
    });

    if (!lesson) {
      return;
    }

    const durationMinutes = Math.max(1, Math.ceil(video.durationSeconds / 60));
    if (lesson.durationMinutes !== durationMinutes) {
      lesson.durationMinutes = durationMinutes;
      await this.lessonRepository.save(lesson);
    }

    await this.updateCourseStats(lesson.moduleId);
  }

  private async updateCourseStats(moduleId: string): Promise<void> {
    const module = await this.moduleRepository.findOne({
      where: { id: moduleId },
    });

    if (!module) {
      return;
    }

    const lessons = await this.lessonRepository.find({
      where: { module: { courseId: module.courseId } },
    });

    const course = await this.courseRepository.findOne({
      where: { id: module.courseId },
    });

    if (!course) {
      return;
    }

    course.lessonCount = lessons.length;
    course.totalDurationMinutes = lessons.reduce(
      (sum, lesson) => sum + (lesson.durationMinutes || 0),
      0,
    );

    await this.courseRepository.save(course);
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(payload: any): Promise<void> {
    // payload: { VideoGuid, LibraryId, Status, ... }
    if (!payload || !payload.VideoGuid) {
      this.logger.warn('Invalid webhook payload');
      return;
    }

    const video = await this.videoRepository.findOne({
      where: { bunnyVideoId: payload.VideoGuid },
    });
    if (!video) {
      this.logger.warn(`Video resource not found for webhook event: ${payload.VideoGuid}`);
      return;
    }

    const statusCode = Number(payload.Status ?? payload.status ?? 0);
    video.status = this.mapWebhookStatus(statusCode);

    const durationSeconds = this.extractDurationSeconds(payload);
    if (durationSeconds > 0) {
      video.durationSeconds = durationSeconds;
    }

    if (video.status === VideoStatus.READY) {
      video.thumbnailUrl = `https://${video.libraryId}.b-cdn.net/${video.bunnyVideoId}/thumbnail.jpg`;
    }

    await this.videoRepository.save(video);

    if (video.status === VideoStatus.READY) {
      await this.updateLinkedLessonAndCourseDurations(video);
      this.logger.log(`Video processed and ready: ${video.title} (${video.bunnyVideoId})`);
    } else if (video.status === VideoStatus.FAILED) {
      this.logger.error(`Video encoding failed: ${video.bunnyVideoId}`);
    }
  }
}
