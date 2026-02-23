import {
    IsString,
    IsOptional,
    IsEnum,
    IsInt,
    IsUUID,
    IsBoolean,
    MaxLength,
    Min,
    Max,
} from 'class-validator';
import { VideoVisibility } from '../entities/video.entity';

export class CreateVideoDto {
    @IsString()
    @MaxLength(255)
    titleAr!: string;

    @IsString()
    @MaxLength(255)
    titleEn!: string;

    @IsOptional()
    @IsString()
    descriptionAr?: string;

    @IsOptional()
    @IsString()
    descriptionEn?: string;

    @IsOptional()
    @IsUUID()
    lessonId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    grade?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    subject?: string;

    @IsOptional()
    @IsEnum(VideoVisibility)
    visibility?: VideoVisibility;

    @IsOptional()
    @IsBoolean()
    requiresAuth?: boolean;

    @IsOptional()
    @IsBoolean()
    requiresSubscription?: boolean;
}

export class UpdateVideoDto {
    @IsOptional()
    @IsString()
    @MaxLength(255)
    titleAr?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    titleEn?: string;

    @IsOptional()
    @IsString()
    descriptionAr?: string;

    @IsOptional()
    @IsString()
    descriptionEn?: string;

    @IsOptional()
    @IsEnum(VideoVisibility)
    visibility?: VideoVisibility;
}

export class UploadVideoDto {
    @IsString()
    filename!: string;

    @IsOptional()
    @IsString()
    collectionId?: string;
}

export class UpdateProgressDto {
    @IsInt()
    @Min(0)
    positionSeconds!: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    totalWatched?: number;

    @IsOptional()
    @IsString()
    quality?: string;

    @IsOptional()
    @Min(0.5)
    @Max(2)
    playbackSpeed?: number;
}

export class VideoQueryDto {
    @IsOptional()
    @IsString()
    grade?: string;

    @IsOptional()
    @IsString()
    subject?: string;

    @IsOptional()
    @IsUUID()
    lessonId?: string;

    @IsOptional()
    @IsString()
    search?: string;
}

export interface SignedVideoUrl {
    videoId: string;
    playlistUrl: string;
    thumbnailUrl?: string;
    expiresAt: Date;
    token: string;
}

export interface VideoProgress {
    videoId: string;
    lastPosition: number;
    completionPercentage: number;
    isCompleted: boolean;
}
