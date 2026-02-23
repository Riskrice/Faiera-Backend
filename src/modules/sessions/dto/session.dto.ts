import {
    IsString,
    IsOptional,
    IsEnum,
    IsInt,
    IsUUID,
    IsBoolean,
    IsNumber,
    IsDate,
    MaxLength,
    Min,
    Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SessionType, RecurrenceType } from '../entities/live-session.entity';

export class CreateSessionDto {
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

    @IsEnum(SessionType)
    type!: SessionType;

    @IsString()
    @MaxLength(50)
    grade!: string;

    @IsString()
    @MaxLength(100)
    subject!: string;

    @IsOptional()
    @IsString()
    topic?: string;

    @IsOptional()
    @IsUUID()
    lessonId?: string;

    @IsOptional()
    @IsUUID()
    moduleId?: string;

    @IsOptional()
    @IsUUID()
    courseId?: string;

    @Type(() => Date)
    @IsDate()
    scheduledStartTime!: Date;

    @IsInt()
    @Min(15)
    @Max(180)
    durationMinutes!: number;

    @IsOptional()
    @IsEnum(RecurrenceType)
    recurrence?: RecurrenceType;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(500)
    maxParticipants?: number;

    @IsOptional()
    @IsBoolean()
    recordingEnabled?: boolean;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsBoolean()
    notifyBefore24h?: boolean;

    @IsOptional()
    @IsBoolean()
    notifyBefore1h?: boolean;
}

export class UpdateSessionDto {
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
    topic?: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    scheduledStartTime?: Date;

    @IsOptional()
    @IsInt()
    @Min(15)
    @Max(180)
    durationMinutes?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(500)
    maxParticipants?: number;

    @IsOptional()
    @IsBoolean()
    recordingEnabled?: boolean;
}

import { PaginationQueryDto } from '../../../common/dto';

export class SessionQueryDto extends PaginationQueryDto {
    @IsOptional()
    @IsEnum(SessionType)
    type?: SessionType;

    @IsOptional()
    @IsString()
    grade?: string;

    @IsOptional()
    @IsString()
    subject?: string;

    @IsOptional()
    @IsUUID()
    hostId?: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    fromDate?: Date;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    toDate?: Date;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    includeRegistration?: boolean;
}

export class RateSessionDto {
    @IsInt()
    @Min(1)
    @Max(5)
    rating!: number;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    feedback?: string;
}
