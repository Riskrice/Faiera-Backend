import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import bunnyConfig from '../../config/bunny.config';
import { VideoResource, VideoStatus } from '../content/entities/video-resource.entity';

@Injectable()
export class BunnyNetService {
    private readonly logger = new Logger(BunnyNetService.name);
    private readonly baseUrl = 'https://video.bunnycdn.com';

    constructor(
        @Inject(bunnyConfig.KEY)
        private config: ConfigType<typeof bunnyConfig>,
        @InjectRepository(VideoResource)
        private readonly videoRepository: Repository<VideoResource>,
    ) { }

    /**
     * Create a video object in Bunny.net to prepare for upload
     */
    async createVideo(title: string): Promise<{ videoId: string; libraryId: string; uploadSignature: string; authorizationSignature: string; expirationTime: number }> {
        try {
            const libraryId = this.config.libraryId;
            const apiKey = this.config.apiKey;

            if (!libraryId || !apiKey) {
                throw new Error('Bunny.net configuration missing');
            }

            const response = await axios.post(
                `${this.baseUrl}/library/${libraryId}/videos`,
                { title },
                { headers: { AccessKey: apiKey } }
            );

            const videoId = response.data.guid;

            // Generate signatures for frontend direct upload (TUS)
            const expirationTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours — safe for slow connections and large files (up to 11GB)
            const uploadSignature = this.generateSignature(libraryId, videoId, expirationTime);

            this.logger.debug(`Generated TUS credentials for ${videoId}: library=${libraryId}, expire=${expirationTime}, sig=${uploadSignature.substring(0, 8)}...`);

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
    verifyWebhookSignature(payload: string, signature: string): boolean {
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
        const expectedSignature = crypto
            .createHash('sha256')
            .update(libraryId + apiKey + payload)
            .digest('hex');

        try {
            return crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature),
            );
        } catch {
            return false;
        }
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

        const video = await this.videoRepository.findOne({ where: { bunnyVideoId: payload.VideoGuid } });
        if (!video) {
            this.logger.warn(`Video resource not found for webhook event: ${payload.VideoGuid}`);
            return;
        }

        // Status 3 = Finished
        if (payload.Status === 3) {
            video.status = VideoStatus.READY;

            // If duration is provided in seconds
            if (payload.Length) {
                video.durationSeconds = payload.Length;
            }

            // Thumbnail URL default logic for Bunny
            // https://{pull-zone}.b-cdn.net/{videoId}/{thumbnailName}.jpg
            // We just construct or store what provides.
            // Bunny usually provides a poster/thumbnail URL handling via dynamic URL.
            // Let's assume standard format:
            video.thumbnailUrl = `https://${video.libraryId}.b-cdn.net/${video.bunnyVideoId}/thumbnail.jpg`;

            await this.videoRepository.save(video);
            this.logger.log(`Video processed and ready: ${video.title} (${video.bunnyVideoId})`);
        } else if (payload.Status === 4) {
            video.status = VideoStatus.FAILED;
            await this.videoRepository.save(video);
            this.logger.error(`Video encoding failed: ${video.bunnyVideoId}`);
        }
    }
}
