import {
    IsString,
    IsOptional,
    IsEnum,
    IsInt,
    IsUUID,
    IsBoolean,
    IsNumber,
    IsArray,
    IsDate,
    MaxLength,
    Min,
    Max,
    ValidateNested,
    IsEmail,
    MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TeachingLevel, TeacherStatus } from '../entities/teacher-profile.entity';
import { DayOfWeek } from '../entities/teacher-availability.entity';

// ==================== Profile DTOs ====================

export class QualificationDto {
    @IsString()
    degree!: string;

    @IsString()
    institution!: string;

    @IsInt()
    year!: number;
}

export class CertificationDto {
    @IsString()
    name!: string;

    @IsString()
    issuer!: string;

    @IsInt()
    year!: number;

    @IsOptional()
    @IsInt()
    expiryYear?: number;
}

// ==================== Admin DTOs ====================
export class CreateTeacherFullDto {
    @IsString()
    firstName!: string;

    @IsString()
    lastName!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(8)
    password!: string;

    @IsOptional()
    @IsString()
    bio?: string;

    @IsOptional()
    @IsString()
    avatar?: string;
}

export class CreateTeacherProfileDto {
    @IsString()
    @MaxLength(500)
    bioAr!: string;

    @IsString()
    @MaxLength(500)
    bioEn!: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    headline?: string;

    @IsArray()
    @IsString({ each: true })
    subjects!: string[];

    @IsArray()
    @IsString({ each: true })
    grades!: string[];

    @IsOptional()
    @IsEnum(TeachingLevel)
    teachingLevel?: TeachingLevel;

    @IsOptional()
    @IsInt()
    @Min(0)
    yearsOfExperience?: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => QualificationDto)
    qualifications?: QualificationDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CertificationDto)
    certifications?: CertificationDto[];

    @IsOptional()
    @IsNumber()
    @Min(0)
    hourlyRate?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    groupSessionRate?: number;

    @IsOptional()
    @IsInt()
    @Min(15)
    @Max(180)
    defaultSessionDuration?: number;

    @IsOptional()
    @IsBoolean()
    offersOneOnOne?: boolean;

    @IsOptional()
    @IsBoolean()
    offersGroupSessions?: boolean;
}

export class UpdateTeacherProfileDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    bioAr?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    bioEn?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    headline?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    subjects?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    grades?: string[];

    @IsOptional()
    @IsNumber()
    @Min(0)
    hourlyRate?: number;

    @IsOptional()
    @IsBoolean()
    isAvailable?: boolean;
}

// ==================== Availability DTOs ====================

export class CreateAvailabilityDto {
    @IsEnum(DayOfWeek)
    dayOfWeek!: DayOfWeek;

    @IsString()
    startTime!: string; // HH:mm format

    @IsString()
    endTime!: string;

    @IsOptional()
    @IsBoolean()
    isRecurring?: boolean;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    specificDate?: Date;
}

export class UpdateAvailabilityDto {
    @IsOptional()
    @IsString()
    startTime?: string;

    @IsOptional()
    @IsString()
    endTime?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

// ==================== Booking DTOs ====================

export class CreateBookingDto {
    @IsUUID()
    teacherId!: string;

    @Type(() => Date)
    @IsDate()
    scheduledStartTime!: Date;

    @IsInt()
    @Min(15)
    @Max(180)
    durationMinutes!: number;

    @IsString()
    @MaxLength(100)
    subject!: string;

    @IsString()
    @MaxLength(50)
    grade!: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    topic?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class RescheduleBookingDto {
    @Type(() => Date)
    @IsDate()
    newStartTime!: Date;

    @IsOptional()
    @IsString()
    reason?: string;
}

export class CancelBookingDto {
    @IsString()
    @MaxLength(500)
    reason!: string;
}

// ==================== Review DTOs ====================

export class CreateReviewDto {
    @IsUUID()
    teacherId!: string;

    @IsOptional()
    @IsUUID()
    bookingId?: string;

    @IsInt()
    @Min(1)
    @Max(5)
    rating!: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(5)
    teachingQuality?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(5)
    communication?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(5)
    punctuality?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(5)
    subjectKnowledge?: number;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    comment?: string;
}

export class RespondToReviewDto {
    @IsString()
    @MaxLength(500)
    response!: string;
}

// ==================== Query DTOs ====================
import { PaginationQueryDto } from '../../../common/dto';

export class TeacherQueryDto extends PaginationQueryDto {
    @IsOptional()
    @IsString()
    subject?: string;

    @IsOptional()
    @IsString()
    grade?: string;

    @IsOptional()
    @IsEnum(TeacherStatus)
    status?: TeacherStatus;

    @IsOptional()
    @IsNumber()
    @Min(0)
    minRating?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    maxPrice?: number;
}

export class AvailableSlotsQueryDto {
    @Type(() => Date)
    @IsDate()
    date!: Date;

    @IsOptional()
    @IsInt()
    @Min(15)
    duration?: number;
}

// ==================== Withdrawal DTOs ====================

export class RequestWithdrawalDto {
    @IsNumber()
    @Min(1)
    amount!: number;

    @IsOptional()
    paymentDetails?: any;
}

export class ProcessWithdrawalDto {
    @IsEnum(['APPROVE', 'REJECT'])
    action!: 'APPROVE' | 'REJECT';

    @IsString()
    @IsOptional()
    adminNotes?: string;
}

// ==================== Package DTOs ====================

export class CreatePackageDto {
    @IsString()
    @MaxLength(255)
    name!: string;

    @IsNumber()
    @Min(0)
    price!: number;

    @IsOptional()
    @IsString()
    @MaxLength(3)
    currency?: string;

    @IsOptional()
    @IsEnum(['monthly', 'quarterly', 'term', 'yearly'])
    billingCycle?: 'monthly' | 'quarterly' | 'term' | 'yearly';

    @IsString()
    @MaxLength(100)
    educationalStage!: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    features?: string[];
}

export class UpdatePackageDto {
    @IsOptional()
    @IsString()
    @MaxLength(255)
    name?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsString()
    @MaxLength(3)
    currency?: string;

    @IsOptional()
    @IsEnum(['monthly', 'quarterly', 'term', 'yearly'])
    billingCycle?: 'monthly' | 'quarterly' | 'term' | 'yearly';

    @IsOptional()
    @IsString()
    @MaxLength(100)
    educationalStage?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    features?: string[];

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
