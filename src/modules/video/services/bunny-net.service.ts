import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';

export interface BunnyVideoInfo {
    videoId: string;
    libraryId: string;
    title: string;
    status: number;
    length: number;
    views: number;
    dateUploaded: string;
    thumbnailUrl: string;
    hlsUrl: string;
    availableResolutions: string[];
    captions: Array<{ language: string; label: string }>;
}

export interface BunnyUploadCredentials {
    videoId: string;
    libraryId: string;
    uploadUrl: string;
    authorizationSignature: string;
    authorizationExpire: number;
}

@Injectable()
export class BunnyNetService {
    private readonly logger = new Logger(BunnyNetService.name);
    private readonly apiKey: string;
    private readonly libraryId: string;
    private readonly cdnHostname: string;
    private readonly streamHostname: string;
    private readonly tokenAuthKey: string;
    private readonly baseUrl = 'https://video.bunnycdn.com';

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('BUNNY_API_KEY', '');
        this.libraryId = this.configService.get<string>('BUNNY_LIBRARY_ID', '');
        this.cdnHostname = this.configService.get<string>('BUNNY_CDN_HOSTNAME', 'vz-xxx.b-cdn.net');
        this.streamHostname = this.configService.get<string>('BUNNY_STREAM_HOSTNAME', 'iframe.mediadelivery.net');
        this.tokenAuthKey = this.configService.get<string>('BUNNY_TOKEN_AUTH_KEY', '');
    }

    async createVideo(title: string, collectionId?: string): Promise<BunnyUploadCredentials> {
        this.logger.log(`Creating video in Bunny.net: ${title}`);

        if (!this.apiKey || !this.libraryId) {
            throw new Error('Bunny.net API key or Library ID not configured');
        }

        const body: Record<string, string> = { title };
        if (collectionId) body.collectionId = collectionId;

        const response = await axios.post(
            `${this.baseUrl}/library/${this.libraryId}/videos`,
            body,
            { headers: { AccessKey: this.apiKey, 'Content-Type': 'application/json' } },
        );

        const videoId: string = response.data.guid;
        const expirationTime = Math.floor(Date.now() / 1000) + 3600;

        return {
            videoId,
            libraryId: this.libraryId,
            uploadUrl: `${this.baseUrl}/library/${this.libraryId}/videos/${videoId}`,
            authorizationSignature: this.generateUploadSignature(videoId),
            authorizationExpire: expirationTime,
        };
    }

    async getVideoInfo(videoId: string): Promise<BunnyVideoInfo | null> {
        this.logger.log(`Getting video info: ${videoId}`);

        if (!this.apiKey || !this.libraryId) {
            this.logger.warn('Bunny.net not configured, cannot fetch video info');
            return null;
        }

        try {
            const response = await axios.get(
                `${this.baseUrl}/library/${this.libraryId}/videos/${videoId}`,
                { headers: { AccessKey: this.apiKey } },
            );

            const data = response.data;
            return {
                videoId: data.guid,
                libraryId: this.libraryId,
                title: data.title || '',
                status: data.status ?? 0,
                length: data.length ?? 0,
                views: data.views ?? 0,
                dateUploaded: data.dateUploaded || new Date().toISOString(),
                thumbnailUrl: `https://${this.cdnHostname}/${data.guid}/thumbnail.jpg`,
                hlsUrl: `https://${this.streamHostname}/embed/${this.libraryId}/${data.guid}`,
                availableResolutions: (data.availableResolutions as string || '').split(',').filter(Boolean),
                captions: (data.captions || []).map((c: any) => ({ language: c.srclang, label: c.label })),
            };
        } catch (error: any) {
            if (error?.response?.status === 404) {
                this.logger.warn(`Video not found in Bunny.net: ${videoId}`);
                return null;
            }
            this.logger.error(`Failed to get video info: ${videoId}`, error?.message);
            throw error;
        }
    }

    async deleteVideo(videoId: string): Promise<void> {
        this.logger.log(`Deleting video: ${videoId}`);

        if (!this.apiKey || !this.libraryId) {
            this.logger.warn('Bunny.net not configured, cannot delete video');
            return;
        }

        await axios.delete(
            `${this.baseUrl}/library/${this.libraryId}/videos/${videoId}`,
            { headers: { AccessKey: this.apiKey } },
        );

        this.logger.log(`Video deleted from Bunny.net: ${videoId}`);
    }

    generateSignedUrl(
        videoId: string,
        expirationSeconds: number = 3600,
        userId?: string,
    ): {
        playlistUrl: string;
        thumbnailUrl: string;
        token: string;
        expiresAt: Date;
    } {
        const expiresAt = new Date(Date.now() + expirationSeconds * 1000);
        const expires = Math.floor(expiresAt.getTime() / 1000);

        // Generate token for URL signing
        const pathToSign = `/${this.libraryId}/${videoId}/playlist.m3u8`;
        const token = this.generateToken(pathToSign, expires, userId);

        const playlistUrl = `https://${this.streamHostname}${pathToSign}?token=${token}&expires=${expires}`;
        const thumbnailUrl = `https://${this.cdnHostname}/${videoId}/thumbnail.jpg`;

        return {
            playlistUrl,
            thumbnailUrl,
            token,
            expiresAt,
        };
    }

    generateEmbedUrl(videoId: string, options?: {
        autoplay?: boolean;
        loop?: boolean;
        muted?: boolean;
        preload?: boolean;
    }): string {
        const params = new URLSearchParams();

        if (options?.autoplay) params.set('autoplay', 'true');
        if (options?.loop) params.set('loop', 'true');
        if (options?.muted) params.set('muted', 'true');
        if (options?.preload) params.set('preload', 'true');

        const queryString = params.toString();
        const baseUrl = `https://${this.streamHostname}/embed/${this.libraryId}/${videoId}`;

        return queryString ? `${baseUrl}?${queryString}` : baseUrl;
    }

    async addCaption(
        videoId: string,
        language: string,
        label: string,
        captionFile: Buffer,
    ): Promise<void> {
        this.logger.log(`Adding caption to video ${videoId}: ${language}`);

        if (!this.apiKey || !this.libraryId) {
            this.logger.warn('Bunny.net not configured, cannot add caption');
            return;
        }

        await axios.post(
            `${this.baseUrl}/library/${this.libraryId}/videos/${videoId}/captions/${language}`,
            {
                srclang: language,
                label,
                captionsFile: captionFile.toString('base64'),
            },
            { headers: { AccessKey: this.apiKey, 'Content-Type': 'application/json' } },
        );

        this.logger.log(`Caption added to video ${videoId}: ${language} (${label})`);
    }

    async setThumbnail(videoId: string, thumbnailTime?: number): Promise<string> {
        this.logger.log(`Setting thumbnail for video: ${videoId}`);

        if (!this.apiKey || !this.libraryId) {
            return `https://${this.cdnHostname}/${videoId}/thumbnail.jpg`;
        }

        if (thumbnailTime !== undefined) {
            await axios.post(
                `${this.baseUrl}/library/${this.libraryId}/videos/${videoId}`,
                { thumbnailTime },
                { headers: { AccessKey: this.apiKey, 'Content-Type': 'application/json' } },
            );
        }

        return `https://${this.cdnHostname}/${videoId}/thumbnail.jpg`;
    }

    getVideoStatusText(status: number): string {
        const statusMap: Record<number, string> = {
            0: 'created',
            1: 'uploading',
            2: 'processing',
            3: 'encoding',
            4: 'ready',
            5: 'error',
            6: 'upload_failed',
        };
        return statusMap[status] || 'unknown';
    }

    private generateToken(path: string, expires: number, userId?: string): string {
        // Token generation for URL signing
        // Format: base64(sha256(tokenAuthKey + path + expires + userId))

        const data = this.tokenAuthKey + path + expires.toString() + (userId || '');
        const hash = crypto.createHash('sha256').update(data).digest('base64url');

        return hash;
    }

    private generateUploadSignature(videoId: string): string {
        const data = this.apiKey + videoId + Date.now().toString();
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    validateWebhookSignature(payload: string, signature: string): boolean {
        const expectedSignature = crypto
            .createHmac('sha256', this.apiKey)
            .update(payload)
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature),
        );
    }
}
