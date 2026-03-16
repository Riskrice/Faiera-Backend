import {
    IsString,
    IsOptional,
    IsEnum,
    IsInt,
    IsUUID,
    IsUrl,
    MaxLength,
    Min,
    ValidateNested,
    IsBoolean,
    IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CourseStatus } from '../entities/course.entity';
import { LessonType } from '../entities/lesson.entity';
import { PaginationQueryDto } from '../../../common/dto';

export class CreateCourseDto {
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
    programId?: string;

    @IsOptional()
    @IsUUID()
    teacherId?: string;

    @IsString()
    @MaxLength(255)
    subject!: string;

    @IsString()
    @MaxLength(100)
    grade!: string;

    @IsString()
    @MaxLength(100)
    term!: string;

    @IsOptional()
    @IsString()
    thumbnailUrl?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsString()
    @MaxLength(10)
    currency?: string;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => CreateCourseModuleDto)
    sections?: CreateCourseModuleDto[];
}

export class CreateCourseLessonDto {
    @IsString()
    @MaxLength(255)
    titleAr!: string;

    @IsString()
    @MaxLength(255)
    titleEn!: string;

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
    @IsString()
    videoUrl?: string; // Can be URL or Bunny video ID with prefix

    @IsOptional()
    @IsBoolean()
    isFree?: boolean;

    @IsOptional()
    @IsString()
    contentAr?: string;

    @IsOptional()
    @IsString()
    contentEn?: string;
}

export class CreateCourseModuleDto {
    @IsString()
    @MaxLength(255)
    titleAr!: string;

    @IsString()
    @MaxLength(255)
    titleEn!: string;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => CreateCourseLessonDto)
    lessons?: CreateCourseLessonDto[];
}

export class UpdateCourseDto {
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
    @IsString()
    subject?: string;

    @IsOptional()
    @IsString()
    grade?: string;

    @IsOptional()
    @IsString()
    term?: string;

    @IsOptional()
    @IsUUID()
    teacherId?: string;

    @IsOptional()
    @IsUrl()
    thumbnailUrl?: string;

    // Note: status changes should go through dedicated publish/archive endpoints

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsString()
    @MaxLength(10)
    currency?: string;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => CreateCourseModuleDto)
    sections?: CreateCourseModuleDto[];
}

export class CourseQueryDto extends PaginationQueryDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @IsString()
    level?: string;

    @IsOptional()
    @IsEnum(CourseStatus)
    status?: CourseStatus;

    @IsOptional()
    @IsUUID()
    programId?: string;

    @IsOptional()
    @IsUUID()
    teacherId?: string;
}

