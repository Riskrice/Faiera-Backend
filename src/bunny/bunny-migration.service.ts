import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  BunnyGetUploadCredentialsInput,
  BunnyUnifiedService,
  BunnyWebhookVerificationInput,
  BunnyWebhookVerificationResult,
} from './bunny-unified.service';
import { BunnyNetService as LegacyBunnyService } from '../modules/bunny/bunny.service';

export interface BunnyMigrationUploadCredentials {
  videoId: string;
  libraryId: string;
  uploadUrl: string;
  authorizationSignature: string;
  authorizationExpire: number;
  uploadSignature: string;
  expirationTime: number;
  reused: boolean;
  source: 'legacy' | 'unified';
}

export interface BunnyMigrationSignedUrl {
  token: string;
  expiresAt: Date;
  embedUrl: string;
  playlistUrl: string;
  thumbnailUrl: string;
  libraryId: string;
  source: 'legacy' | 'unified';
}

export interface BunnyMigrationWebhookVerificationResult extends BunnyWebhookVerificationResult {
  source: 'legacy' | 'unified';
}

@Injectable()
export class BunnyMigrationService {
  private readonly logger = new Logger(BunnyMigrationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly unifiedService: BunnyUnifiedService,
    private readonly legacyService: LegacyBunnyService,
  ) {}

  shouldUseUnified(routeKey?: string): boolean {
    const { enabled, rolloutPercentage } = this.getRolloutConfig();

    if (!enabled || rolloutPercentage <= 0) {
      return false;
    }

    if (rolloutPercentage >= 100) {
      return true;
    }

    const bucket = this.computeBucket(routeKey ?? `${Date.now()}-${Math.random()}`);
    return bucket < rolloutPercentage;
  }

  async createVideoWithFallback(input: {
    title: string;
    collectionId?: string;
    existingVideoId?: string;
    forceNew?: boolean;
    routeKey?: string;
  }): Promise<BunnyMigrationUploadCredentials> {
    const routeKey = input.routeKey ?? `create:${input.title}:${input.existingVideoId ?? ''}`;

    if (this.shouldUseUnified(routeKey)) {
      try {
        const unified = await this.unifiedService.createVideo({
          title: input.title,
          collectionId: input.collectionId,
          existingVideoId: input.existingVideoId,
          forceNew: input.forceNew,
        });

        this.logRoute('createVideoWithFallback', routeKey, 'unified');
        return {
          videoId: unified.videoId,
          libraryId: unified.libraryId,
          uploadUrl: unified.uploadUrl,
          authorizationSignature: unified.authorizationSignature,
          authorizationExpire: unified.authorizationExpire,
          uploadSignature: unified.authorizationSignature,
          expirationTime: unified.authorizationExpire,
          reused: unified.reused,
          source: 'unified',
        };
      } catch (error) {
        this.alertFallback('createVideoWithFallback', routeKey, error);
      }
    }

    const legacy = await this.legacyService.createVideo(input.title);
    this.logRoute('createVideoWithFallback', routeKey, 'legacy');

    return {
      videoId: legacy.videoId,
      libraryId: legacy.libraryId,
      uploadUrl: `https://video.bunnycdn.com/library/${legacy.libraryId}/videos/${legacy.videoId}`,
      authorizationSignature: legacy.authorizationSignature,
      authorizationExpire: legacy.expirationTime,
      uploadSignature: legacy.uploadSignature,
      expirationTime: legacy.expirationTime,
      reused: false,
      source: 'legacy',
    };
  }

  async getCredentialsWithFallback(
    input: BunnyGetUploadCredentialsInput & { routeKey?: string },
  ): Promise<BunnyMigrationUploadCredentials> {
    const routeKey = input.routeKey ?? `credentials:${input.videoId ?? ''}:${input.title ?? ''}`;

    if (this.shouldUseUnified(routeKey)) {
      try {
        const unified = await this.unifiedService.getUploadCredentials(input);
        this.logRoute('getCredentialsWithFallback', routeKey, 'unified');

        return {
          videoId: unified.videoId,
          libraryId: unified.libraryId,
          uploadUrl: unified.uploadUrl,
          authorizationSignature: unified.authorizationSignature,
          authorizationExpire: unified.authorizationExpire,
          uploadSignature: unified.authorizationSignature,
          expirationTime: unified.authorizationExpire,
          reused: unified.reused,
          source: 'unified',
        };
      } catch (error) {
        this.alertFallback('getCredentialsWithFallback', routeKey, error);
      }
    }

    const reusableVideoId = input.videoId?.trim();
    if (reusableVideoId && !input.forceNew) {
      const legacyExisting = await this.legacyService.getUploadCredentials(reusableVideoId);
      this.logRoute('getCredentialsWithFallback', routeKey, 'legacy', {
        reused: true,
        videoId: reusableVideoId,
      });

      return {
        videoId: legacyExisting.videoId,
        libraryId: legacyExisting.libraryId,
        uploadUrl: `https://video.bunnycdn.com/library/${legacyExisting.libraryId}/videos/${legacyExisting.videoId}`,
        authorizationSignature: legacyExisting.authorizationSignature,
        authorizationExpire: legacyExisting.expirationTime,
        uploadSignature: legacyExisting.uploadSignature,
        expirationTime: legacyExisting.expirationTime,
        reused: true,
        source: 'legacy',
      };
    }

    if (!input.title?.trim()) {
      throw new Error('Legacy Bunny path requires title when no reusable videoId is provided');
    }

    const legacy = await this.legacyService.createVideo(input.title.trim());
    this.logRoute('getCredentialsWithFallback', routeKey, 'legacy');

    return {
      videoId: legacy.videoId,
      libraryId: legacy.libraryId,
      uploadUrl: `https://video.bunnycdn.com/library/${legacy.libraryId}/videos/${legacy.videoId}`,
      authorizationSignature: legacy.authorizationSignature,
      authorizationExpire: legacy.expirationTime,
      uploadSignature: legacy.uploadSignature,
      expirationTime: legacy.expirationTime,
      reused: false,
      source: 'legacy',
    };
  }

  generateSignedUrlWithFallback(
    videoId: string,
    expiresInSeconds = 3600,
    userId?: string,
    routeKey?: string,
  ): BunnyMigrationSignedUrl {
    const resolvedRouteKey = routeKey ?? `playback:${videoId}:${userId ?? 'anon'}`;

    if (this.shouldUseUnified(resolvedRouteKey)) {
      try {
        const playback = this.unifiedService.generatePlaybackToken({
          videoId,
          expiresInSeconds,
          userId,
        });

        const libraryId = this.legacyService.getLibraryId();
        const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?token=${playback.token}&expires=${playback.expires}`;

        this.logRoute('generateSignedUrlWithFallback', resolvedRouteKey, 'unified');
        return {
          token: playback.token,
          expiresAt: new Date(playback.expires * 1000),
          embedUrl,
          playlistUrl: playback.playlistUrl,
          thumbnailUrl: playback.thumbnailUrl,
          libraryId,
          source: 'unified',
        };
      } catch (error) {
        this.alertFallback('generateSignedUrlWithFallback', resolvedRouteKey, error);
      }
    }

    const token = this.legacyService.generateSignedUrl(videoId, expiresInSeconds);
    const libraryId = this.legacyService.getLibraryId();
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?token=${token}`;

    this.logRoute('generateSignedUrlWithFallback', resolvedRouteKey, 'legacy');
    return {
      token,
      expiresAt,
      embedUrl,
      playlistUrl: `https://iframe.mediadelivery.net/${libraryId}/${videoId}/playlist.m3u8?token=${token}`,
      thumbnailUrl: `https://${libraryId}.b-cdn.net/${videoId}/thumbnail.jpg`,
      libraryId,
      source: 'legacy',
    };
  }

  verifyWebhookWithFallback(
    input: BunnyWebhookVerificationInput & { routeKey?: string },
  ): BunnyMigrationWebhookVerificationResult {
    const routeKey = input.routeKey ?? `webhook:${String(input.payload?.VideoGuid ?? 'unknown')}`;

    if (this.shouldUseUnified(routeKey)) {
      try {
        const unifiedResult = this.unifiedService.verifyWebhook(input);
        this.logRoute('verifyWebhookWithFallback', routeKey, 'unified', {
          valid: unifiedResult.valid,
          strategy: unifiedResult.strategy,
        });
        return {
          ...unifiedResult,
          source: 'unified',
        };
      } catch (error) {
        this.alertFallback('verifyWebhookWithFallback', routeKey, error);
      }
    }

    const securityTokenResult = this.verifySecurityToken(input.payload);
    if (securityTokenResult) {
      this.logRoute('verifyWebhookWithFallback', routeKey, 'legacy', {
        valid: securityTokenResult.valid,
        strategy: securityTokenResult.strategy,
      });
      return {
        ...securityTokenResult,
        source: 'legacy',
      };
    }

    const signature = input.headerSignature?.trim();
    const rawPayload = input.rawBody ?? JSON.stringify(input.payload ?? {});

    const valid = !!signature && this.legacyService.verifyWebhookSignature(rawPayload, signature);
    const result: BunnyMigrationWebhookVerificationResult = {
      valid,
      strategy: signature ? 'header-signature' : 'none',
      reason: valid ? undefined : 'Legacy webhook verification failed',
      source: 'legacy',
    };

    this.logRoute('verifyWebhookWithFallback', routeKey, 'legacy', {
      valid: result.valid,
      strategy: result.strategy,
    });
    return result;
  }

  private verifySecurityToken(
    payload: BunnyWebhookVerificationInput['payload'],
  ): BunnyWebhookVerificationResult | null {
    const token = typeof payload?.SecurityToken === 'string' ? payload.SecurityToken.trim() : '';
    if (!token) {
      return null;
    }

    const signingKey = this.configService.get<string>('bunny.signingKey', '').trim();
    const fallbackLibraryId = this.configService.get<string>('bunny.libraryId', '').trim();

    if (!signingKey) {
      return {
        valid: false,
        strategy: 'security-token',
        reason: 'Missing signing key for security token validation',
      };
    }

    const videoGuid = String(payload.VideoGuid ?? '').trim();
    const libraryId = String(payload.VideoLibraryId ?? fallbackLibraryId).trim();
    const status = String(payload.Status ?? '').trim();

    if (!videoGuid || !libraryId || !status) {
      return {
        valid: false,
        strategy: 'security-token',
        reason: 'Missing required fields for security token verification',
      };
    }

    const expected = crypto
      .createHash('sha256')
      .update(`${videoGuid}${signingKey}${libraryId}${status}`)
      .digest('hex');

    const valid = this.safeEqualHex(token, expected);
    return {
      valid,
      strategy: 'security-token',
      reason: valid ? undefined : 'Invalid SecurityToken value',
    };
  }

  private safeEqualHex(actual: string, expected: string): boolean {
    if (actual.length !== expected.length) {
      return false;
    }

    try {
      const actualBuffer = Buffer.from(actual.toLowerCase(), 'hex');
      const expectedBuffer = Buffer.from(expected.toLowerCase(), 'hex');

      if (actualBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  private getRolloutConfig(): { enabled: boolean; rolloutPercentage: number } {
    const enabled = this.configService.get<boolean>('bunny.migration.useUnifiedService', false);
    const rollout = this.configService.get<number>('bunny.migration.unifiedRolloutPercentage', 0);

    return {
      enabled,
      rolloutPercentage: this.clampPercentage(rollout),
    };
  }

  private clampPercentage(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.floor(value)));
  }

  private computeBucket(seed: string): number {
    const digest = crypto.createHash('sha256').update(seed).digest();
    return digest.readUInt32BE(0) % 100;
  }

  private logRoute(
    operation: string,
    routeKey: string,
    source: 'legacy' | 'unified',
    meta?: Record<string, unknown>,
  ): void {
    this.logger.log(`BUNNY_MIGRATION operation=${operation} source=${source} routeKey=${routeKey}`);
    if (meta) {
      this.logger.debug(`BUNNY_MIGRATION_META operation=${operation} data=${JSON.stringify(meta)}`);
    }
  }

  private alertFallback(operation: string, routeKey: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `BUNNY_CANARY_FALLBACK_ALERT operation=${operation} routeKey=${routeKey} message=${message}`,
    );
  }
}
