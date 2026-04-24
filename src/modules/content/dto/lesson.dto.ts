import {
    IsString,
    IsOptional,
    IsEnum,
    IsInt,
    IsUUID,
    IsUrl,
    IsBoolean,
    ValidateNested,
    MaxLength,
    Min,
    IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LessonType, LessonStatus } from '../entities/lesson.entity';

export class AttachmentDto {
    @IsString()
    id!: string;

    @IsString()
    @MaxLength(255)
    name!: string;

    @IsUrl()
    url!: string;

    @IsOptional()
    @IsString()
    size?: string;

    @IsOptional()
    @IsString()
    type?: string;
}

export class CreateModuleDto {
    @IsOptional() @IsString() title?: string;

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

    @IsUUID()
    courseId!: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;
}

export class UpdateModuleDto {
    @IsOptional() @IsString() title?: string;

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
    @IsBoolean()
    isPublished?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;
}

export class CreateLessonDto {
    @IsOptional() @IsString() title?: string;
    @IsOptional() @IsNumber() duration?: number;
    @IsOptional() @IsString() articleContent?: string;

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

    @IsUUID()
    moduleId!: string;

    @IsEnum(LessonType)
    type!: LessonType;

    @IsOptional()
    @IsInt()
    @Min(0)
    durationMinutes?: number;

    @IsOptional()
    @IsString()
    videoId?: string;

    @IsOptional()
    @IsUrl()
    videoUrl?: string;

    @IsOptional()
    @IsUrl()
    thumbnailUrl?: string;

    @IsOptional()
    @IsString()
    contentAr?: string;

    @IsOptional()
    @IsString()
    contentEn?: string;

    @IsOptional()
    @IsBoolean()
    isFree?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => AttachmentDto)
    attachments?: AttachmentDto[];
}

export class UpdateLessonDto {
    @IsOptional() @IsString() title?: string;
    @IsOptional() @IsNumber() duration?: number;
    @IsOptional() @IsString() articleContent?: string;

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
    @IsEnum(LessonType)
    type?: LessonType;

    @IsOptional()
    @IsEnum(LessonStatus)
    status?: LessonStatus;

    @IsOptional()
    @IsInt()
    @Min(0)
    durationMinutes?: number;

    @IsOptional()
    @IsString()
    videoId?: string;

    @IsOptional()
    @IsUrl()
    videoUrl?: string;

    @IsOptional()
    @IsUrl()
    thumbnailUrl?: string;

    @IsOptional()
    @IsString()
    contentAr?: string;

    @IsOptional()
    @IsString()
    contentEn?: string;

    @IsOptional()
    @IsBoolean()
    isFree?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;

    @IsOptional()
    attachments?: { id: string; name: string; url: string; size?: string; type?: string }[];
}
