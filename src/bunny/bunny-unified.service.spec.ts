import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import {
    BunnyUnifiedService,
    BunnyUploadCredentials,
    BunnyWebhookPayload,
} from './bunny-unified.service';

jest.mock('axios');

type AxiosRequestMock = jest.Mock<Promise<AxiosResponse<unknown>>, [AxiosRequestConfig]>;

describe('BunnyUnifiedService', () => {
    let service: BunnyUnifiedService;
    let requestMock: AxiosRequestMock;

    const mockedAxios = axios as jest.Mocked<typeof axios>;

    const buildConfigService = (overrides?: Record<string, string>): ConfigService => {
        const base: Record<string, string> = {
            NODE_ENV: 'test',
            BUNNY_API_KEY: 'api-key-xyz',
            BUNNY_LIBRARY_ID: 'library-1',
            BUNNY_SIGNING_KEY: 'sign-key-123',
            BUNNY_TOKEN_AUTH_KEY: 'token-key-123',
            BUNNY_STREAM_HOSTNAME: 'iframe.mediadelivery.net',
            BUNNY_CDN_HOSTNAME: 'cdn.example.com',
            BUNNY_UPLOAD_TTL_SECONDS: '86400',
            BUNNY_PLAYBACK_TTL_SECONDS: '3600',
            BUNNY_HTTP_TIMEOUT_MS: '8000',
            BUNNY_HTTP_MAX_RETRIES: '2',
            BUNNY_HTTP_RETRY_BASE_DELAY_MS: '10',
        };

        const values = { ...base, ...(overrides || {}) };

        return {
            get: jest.fn((key: string, defaultValue?: unknown) => {
                if (Object.prototype.hasOwnProperty.call(values, key)) {
                    return values[key];
                }
                return defaultValue;
            }),
        } as unknown as ConfigService;
    };

    beforeEach(() => {
        requestMock = jest.fn();
        mockedAxios.create.mockReturnValue({
            request: requestMock,
        } as unknown as AxiosInstance);

        service = new BunnyUnifiedService(buildConfigService());
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it('reuses existing Bunny video when existingVideoId is valid', async () => {
        const fixedNow = 1700000000000;
        jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

        requestMock.mockResolvedValueOnce({
            data: {
                guid: 'video-existing-1',
                title: 'Intro',
                status: 4,
            },
        } as AxiosResponse<unknown>);

        const result = await service.createVideo({
            title: 'Intro',
            existingVideoId: 'video-existing-1',
        });

        const expectedExpire = Math.floor(fixedNow / 1000) + 86400;
        const expectedSignature = crypto
            .createHash('sha256')
            .update(`library-1api-key-xyz${expectedExpire}video-existing-1`)
            .digest('hex');

        expect(requestMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual<BunnyUploadCredentials>({
            videoId: 'video-existing-1',
            libraryId: 'library-1',
            uploadUrl: 'https://video.bunnycdn.com/library/library-1/videos/video-existing-1',
            authorizationSignature: expectedSignature,
            authorizationExpire: expectedExpire,
            reused: true,
        });
    });

    it('creates a new Bunny video when existingVideoId is missing remotely', async () => {
        requestMock
            .mockRejectedValueOnce({
                response: {
                    status: 404,
                    data: { message: 'Not found' },
                },
                message: 'Not found',
            })
            .mockResolvedValueOnce({
                data: {
                    guid: 'video-new-1',
                },
            } as AxiosResponse<unknown>);

        const result = await service.createVideo({
            title: 'Algebra 101',
            existingVideoId: 'video-missing',
        });

        expect(requestMock).toHaveBeenCalledTimes(2);
        expect(result.videoId).toBe('video-new-1');
        expect(result.reused).toBe(false);
    });

    it('requires title when no reusable video id is available', async () => {
        await expect(service.getUploadCredentials({})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('generates deterministic playback token tuple with expires', () => {
        const fixedNow = 1700000000000;
        jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

        const result = service.generatePlaybackToken({
            videoId: 'video-42',
            expiresInSeconds: 900,
            userId: 'user-1',
        });

        expect(result.expires).toBe(Math.floor(fixedNow / 1000) + 900);
        expect(result.playlistUrl).toContain('/library-1/video-42/playlist.m3u8');
        expect(result.playlistUrl).toContain('token=');
        expect(result.playlistUrl).toContain(`expires=${result.expires}`);
        expect(result.thumbnailUrl).toBe('https://cdn.example.com/video-42/thumbnail.jpg');
    });

    it('verifies webhook SecurityToken correctly', () => {
        const payload: BunnyWebhookPayload = {
            VideoGuid: 'video-abc',
            VideoLibraryId: '12345',
            Status: 4,
        };

        const securityToken = crypto
            .createHash('sha256')
            .update(`${payload.VideoGuid}sign-key-123${payload.VideoLibraryId}${payload.Status}`)
            .digest('hex');

        const result = service.verifyWebhook({
            payload: {
                ...payload,
                SecurityToken: securityToken,
            },
        });

        expect(result.valid).toBe(true);
        expect(result.strategy).toBe('security-token');
    });

    it('fails webhook verification in strict mode when signature is missing', () => {
        const strictService = new BunnyUnifiedService(
            buildConfigService({ NODE_ENV: 'production' }),
        );

        const result = strictService.verifyWebhook({
            payload: {
                VideoGuid: 'video-abc',
                Status: 4,
            },
        });

        expect(result.valid).toBe(false);
        expect(result.strategy).toBe('none');
    });
});
