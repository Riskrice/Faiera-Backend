import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as crypto from 'crypto';

export interface BunnyCreateVideoInput {
  title: string;
  collectionId?: string;
  existingVideoId?: string;
  forceNew?: boolean;
}

export interface BunnyGetUploadCredentialsInput {
  title?: string;
  videoId?: string;
  collectionId?: string;
  forceNew?: boolean;
}

export interface BunnyUploadCredentials {
  videoId: string;
  libraryId: string;
  uploadUrl: string;
  authorizationSignature: string;
  authorizationExpire: number;
  reused: boolean;
}

export interface BunnyVideoDetails {
  videoId: string;
  title: string;
  status: number;
  collectionId?: string;
  dateUploaded?: string;
}

export interface BunnyPlaybackTokenInput {
  videoId: string;
  expiresInSeconds?: number;
  userId?: string;
}

export interface BunnyPlaybackTokenResult {
  token: string;
  expires: number;
  playlistUrl: string;
  thumbnailUrl: string;
}

export interface BunnyWebhookPayload {
  VideoGuid?: string;
  VideoLibraryId?: number | string;
  Status?: number | string;
  SecurityToken?: string;
  [key: string]: unknown;
}

export interface BunnyWebhookVerificationInput {
  payload: BunnyWebhookPayload;
  rawBody?: string;
  headerSignature?: string;
  enforceStrict?: boolean;
}

export type BunnyWebhookVerificationStrategy = 'security-token' | 'header-signature' | 'none';

export interface BunnyWebhookVerificationResult {
  valid: boolean;
  strategy: BunnyWebhookVerificationStrategy;
  reason?: string;
}

interface BunnyCreateVideoResponse {
  guid?: string;
}

interface BunnyVideoResponse {
  guid?: string;
  title?: string;
  status?: number;
  collectionId?: string;
  dateUploaded?: string;
}

@Injectable()
export class BunnyUnifiedService {
  private readonly logger = new Logger(BunnyUnifiedService.name);

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly libraryId: string;
  private readonly signingKey: string;
  private readonly tokenAuthKey: string;
  private readonly streamHostname: string;
  private readonly cdnHostname: string;
  private readonly nodeEnv: string;

  private readonly uploadTtlSeconds: number;
  private readonly playbackTtlSeconds: number;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  private readonly httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'BUNNY_API_BASE_URL',
      'https://video.bunnycdn.com',
    );
    this.apiKey = this.configService.get<string>('BUNNY_API_KEY', '').trim();
    this.libraryId = this.configService.get<string>('BUNNY_LIBRARY_ID', '').trim();
    this.signingKey = this.configService.get<string>('BUNNY_SIGNING_KEY', '').trim();
    this.tokenAuthKey = this.configService.get<string>('BUNNY_TOKEN_AUTH_KEY', '').trim();
    this.streamHostname = this.configService.get<string>(
      'BUNNY_STREAM_HOSTNAME',
      'iframe.mediadelivery.net',
    );
    this.cdnHostname = this.configService.get<string>('BUNNY_CDN_HOSTNAME', 'vz-xxx.b-cdn.net');
    this.nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    this.uploadTtlSeconds = this.parsePositiveInt(
      this.configService.get<string>('BUNNY_UPLOAD_TTL_SECONDS', '86400'),
      86400,
    );
    this.playbackTtlSeconds = this.parsePositiveInt(
      this.configService.get<string>('BUNNY_PLAYBACK_TTL_SECONDS', '3600'),
      3600,
    );
    this.requestTimeoutMs = this.parsePositiveInt(
      this.configService.get<string>('BUNNY_HTTP_TIMEOUT_MS', '8000'),
      8000,
    );
    this.maxRetries = this.parsePositiveInt(
      this.configService.get<string>('BUNNY_HTTP_MAX_RETRIES', '3'),
      3,
    );
    this.retryBaseDelayMs = this.parsePositiveInt(
      this.configService.get<string>('BUNNY_HTTP_RETRY_BASE_DELAY_MS', '250'),
      250,
    );

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: this.requestTimeoutMs,
      headers: {
        AccessKey: this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!this.apiKey || !this.libraryId) {
      this.logger.warn('BunnyUnifiedService is initialized without full Bunny credentials.');
    }
  }

  async createVideo(input: BunnyCreateVideoInput): Promise<BunnyUploadCredentials> {
    this.ensureConfigured();

    const title = input.title?.trim();
    if (!title) {
      throw new BadRequestException('Video title is required');
    }

    const existingVideoId = input.existingVideoId?.trim();
    if (existingVideoId && !input.forceNew) {
      const existingVideo = await this.getVideoDetails(existingVideoId);
      if (existingVideo) {
        return this.buildUploadCredentials(existingVideo.videoId, true);
      }
    }

    const body: Record<string, string> = { title };
    if (input.collectionId?.trim()) {
      body.collectionId = input.collectionId.trim();
    }

    try {
      const response = await this.requestWithRetry<BunnyCreateVideoResponse>(
        {
          method: 'POST',
          url: `/library/${this.libraryId}/videos`,
          data: body,
        },
        'createVideo',
      );

      const videoId = response.data.guid?.trim();
      if (!videoId) {
        throw new InternalServerErrorException('Bunny createVideo returned empty video guid');
      }

      return this.buildUploadCredentials(videoId, false);
    } catch (error) {
      this.throwUpstreamError('createVideo', error);
    }
  }

  async getUploadCredentials(
    input: BunnyGetUploadCredentialsInput,
  ): Promise<BunnyUploadCredentials> {
    this.ensureConfigured();

    const reusableVideoId = input.videoId?.trim();
    if (reusableVideoId && !input.forceNew) {
      const existingVideo = await this.getVideoDetails(reusableVideoId);
      if (existingVideo) {
        return this.buildUploadCredentials(existingVideo.videoId, true);
      }
    }

    const title = input.title?.trim();
    if (!title) {
      throw new BadRequestException('title is required when no reusable Bunny video was found');
    }

    return this.createVideo({
      title,
      collectionId: input.collectionId,
      forceNew: true,
    });
  }

  generatePlaybackToken(input: BunnyPlaybackTokenInput): BunnyPlaybackTokenResult {
    const videoId = input.videoId?.trim();
    if (!videoId) {
      throw new BadRequestException('videoId is required for playback token generation');
    }

    const tokenKey = this.tokenAuthKey || this.signingKey;
    if (!tokenKey) {
      throw new InternalServerErrorException(
        'BUNNY_TOKEN_AUTH_KEY or BUNNY_SIGNING_KEY must be configured for playback tokens',
      );
    }

    const ttl = input.expiresInSeconds ?? this.playbackTtlSeconds;
    const expires = Math.floor(Date.now() / 1000) + ttl;
    const playlistPath = `/${this.libraryId}/${videoId}/playlist.m3u8`;

    // Deterministic token tuple: key + path + expires + optional userId.
    const tokenTuple = `${tokenKey}${playlistPath}${expires}${input.userId ?? ''}`;
    const token = crypto.createHash('sha256').update(tokenTuple).digest('base64url');

    return {
      token,
      expires,
      playlistUrl: `https://${this.streamHostname}${playlistPath}?token=${token}&expires=${expires}`,
      thumbnailUrl: `https://${this.cdnHostname}/${videoId}/thumbnail.jpg`,
    };
  }

  verifyWebhook(input: BunnyWebhookVerificationInput): BunnyWebhookVerificationResult {
    const payload = input.payload;
    const strict = input.enforceStrict ?? this.nodeEnv === 'production';

    const payloadSecurityToken =
      typeof payload.SecurityToken === 'string' ? payload.SecurityToken.trim() : '';

    if (payloadSecurityToken) {
      if (!this.signingKey) {
        return this.invalidWebhook(
          'security-token',
          'BUNNY_SIGNING_KEY is missing while SecurityToken verification is required',
        );
      }

      const videoGuid = String(payload.VideoGuid ?? '').trim();
      const videoLibraryId = String(payload.VideoLibraryId ?? this.libraryId).trim();
      const status = String(payload.Status ?? '').trim();

      if (!videoGuid || !videoLibraryId || !status) {
        return this.invalidWebhook(
          'security-token',
          'Webhook payload missing VideoGuid, VideoLibraryId, or Status',
        );
      }

      const expectedSecurityToken = crypto
        .createHash('sha256')
        .update(`${videoGuid}${this.signingKey}${videoLibraryId}${status}`)
        .digest('hex');

      const valid = this.timingSafeEqualHex(payloadSecurityToken, expectedSecurityToken);
      return valid
        ? { valid: true, strategy: 'security-token' }
        : this.invalidWebhook('security-token', 'Invalid SecurityToken value');
    }

    const headerSignature = input.headerSignature?.trim() ?? '';
    if (headerSignature) {
      if (!this.apiKey || !this.libraryId) {
        return this.invalidWebhook(
          'header-signature',
          'Bunny API key or library id is missing for header signature verification',
        );
      }

      const rawBody = input.rawBody ?? JSON.stringify(payload ?? {});
      const expectedSignature = crypto
        .createHash('sha256')
        .update(`${this.libraryId}${this.apiKey}${rawBody}`)
        .digest('hex');

      const valid = this.timingSafeEqualHex(headerSignature, expectedSignature);
      return valid
        ? { valid: true, strategy: 'header-signature' }
        : this.invalidWebhook('header-signature', 'Invalid signature header value');
    }

    if (strict) {
      return this.invalidWebhook('none', 'No webhook signature provided in strict mode');
    }

    return this.invalidWebhook('none', 'No webhook signature provided');
  }

  async getVideoDetails(videoId: string): Promise<BunnyVideoDetails | null> {
    this.ensureConfigured();

    const normalizedVideoId = videoId.trim();
    if (!normalizedVideoId) {
      throw new BadRequestException('videoId is required');
    }

    try {
      const response = await this.requestWithRetry<BunnyVideoResponse>(
        {
          method: 'GET',
          url: `/library/${this.libraryId}/videos/${normalizedVideoId}`,
        },
        'getVideoDetails',
      );

      const responseVideoId = response.data.guid?.trim();
      if (!responseVideoId) {
        return null;
      }

      return {
        videoId: responseVideoId,
        title: response.data.title ?? '',
        status: response.data.status ?? 0,
        collectionId: response.data.collectionId,
        dateUploaded: response.data.dateUploaded,
      };
    } catch (error) {
      if (this.getAxiosStatus(error) === 404) {
        return null;
      }
      this.throwUpstreamError('getVideoDetails', error);
    }
  }

  private buildUploadCredentials(videoId: string, reused: boolean): BunnyUploadCredentials {
    const expires = Math.floor(Date.now() / 1000) + this.uploadTtlSeconds;
    const authorizationSignature = this.generateUploadSignature(videoId, expires);

    return {
      videoId,
      libraryId: this.libraryId,
      uploadUrl: `${this.baseUrl}/library/${this.libraryId}/videos/${videoId}`,
      authorizationSignature,
      authorizationExpire: expires,
      reused,
    };
  }

  private generateUploadSignature(videoId: string, expirationUnixSeconds: number): string {
    // Deterministic Bunny tuple: libraryId + apiKey + expires + videoId.
    const tuple = `${this.libraryId}${this.apiKey}${expirationUnixSeconds}${videoId}`;
    return crypto.createHash('sha256').update(tuple).digest('hex');
  }

  private ensureConfigured(): void {
    if (!this.apiKey || !this.libraryId) {
      throw new InternalServerErrorException(
        'Bunny API is not configured. BUNNY_API_KEY and BUNNY_LIBRARY_ID are required.',
      );
    }
  }

  private async requestWithRetry<T>(
    requestConfig: AxiosRequestConfig,
    operationName: string,
  ): Promise<AxiosResponse<T>> {
    const maxAttempts = Math.max(1, this.maxRetries + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.httpClient.request<T>(requestConfig);
      } catch (error) {
        const axiosError = error as AxiosError;
        const shouldRetry = attempt < maxAttempts && this.isRetryableError(axiosError);

        if (!shouldRetry) {
          throw error;
        }

        const delayMs = this.calculateBackoffMs(attempt);
        const status = axiosError.response?.status ?? 'network';

        this.logger.warn(
          `Bunny ${operationName} attempt ${attempt}/${maxAttempts} failed (${status}). Retrying in ${delayMs}ms.`,
        );

        await this.sleep(delayMs);
      }
    }

    throw new InternalServerErrorException(`Bunny ${operationName} failed unexpectedly`);
  }

  private isRetryableError(error: AxiosError): boolean {
    const status = error.response?.status;

    if (!error.response) {
      return true;
    }

    if (status === 429) {
      return true;
    }

    return status !== undefined && status >= 500;
  }

  private calculateBackoffMs(attempt: number): number {
    const baseDelay = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.floor(Math.random() * 250);
    return baseDelay + jitter;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private parsePositiveInt(value: string | number, fallback: number): number {
    const parsed = typeof value === 'number' ? value : parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  private getAxiosStatus(error: unknown): number | undefined {
    return (error as AxiosError | undefined)?.response?.status;
  }

  private throwUpstreamError(operationName: string, error: unknown): never {
    const axiosError = error as AxiosError<{ message?: string }>;
    const status = axiosError.response?.status;
    const bunnyMessage = axiosError.response?.data?.message ?? axiosError.message;

    this.logger.error(
      `Bunny ${operationName} failed${status ? ` (${status})` : ''}: ${bunnyMessage}`,
      axiosError.stack,
    );

    if (status !== undefined && status >= 400 && status < 500) {
      throw new BadRequestException(`Bunny ${operationName} rejected the request: ${bunnyMessage}`);
    }

    throw new InternalServerErrorException(`Bunny ${operationName} failed: ${bunnyMessage}`);
  }

  private timingSafeEqualHex(actual: string, expected: string): boolean {
    const normalizedActual = actual.toLowerCase();
    const normalizedExpected = expected.toLowerCase();

    if (normalizedActual.length !== normalizedExpected.length) {
      return false;
    }

    try {
      const actualBuffer = Buffer.from(normalizedActual, 'hex');
      const expectedBuffer = Buffer.from(normalizedExpected, 'hex');

      if (actualBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  private invalidWebhook(
    strategy: BunnyWebhookVerificationStrategy,
    reason: string,
  ): BunnyWebhookVerificationResult {
    this.logger.warn(`Bunny webhook verification failed (${strategy}): ${reason}`);
    return {
      valid: false,
      strategy,
      reason,
    };
  }
}
