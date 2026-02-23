import {
    IsString,
    IsOptional,
    IsEnum,
    IsNumber,
    IsArray,
    IsBoolean,
    IsInt,
    MaxLength,
    Min,
} from 'class-validator';
import { PlanType, PlanStatus } from '../entities/subscription-plan.entity';

export class CreatePlanDto {
    @IsString()
    @MaxLength(255)
    nameAr!: string;

    @IsString()
    @MaxLength(255)
    nameEn!: string;

    @IsOptional()
    @IsString()
    descriptionAr?: string;

    @IsOptional()
    @IsString()
    descriptionEn?: string;

    @IsString()
    @MaxLength(50)
    grade!: string;

    @IsEnum(PlanType)
    type!: PlanType;

    @IsNumber()
    @Min(0)
    price!: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    originalPrice?: number;

    @IsOptional()
    @IsString()
    @MaxLength(3)
    currency?: string;

    @IsInt()
    @Min(1)
    durationDays!: number;

    @IsArray()
    @IsString({ each: true })
    subjects!: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    features?: string[];

    @IsOptional()
    @IsBoolean()
    isPopular?: boolean;

    @IsOptional()
    @IsBoolean()
    isFeatured?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;
}

export class UpdatePlanDto {
    @IsOptional()
    @IsString()
    @MaxLength(255)
    nameAr?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    nameEn?: string;

    @IsOptional()
    @IsString()
    descriptionAr?: string;

    @IsOptional()
    @IsString()
    descriptionEn?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    originalPrice?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    subjects?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    features?: string[];

    @IsOptional()
    @IsEnum(PlanStatus)
    status?: PlanStatus;

    @IsOptional()
    @IsBoolean()
    isPopular?: boolean;

    @IsOptional()
    @IsBoolean()
    isFeatured?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;
}

export class PlanQueryDto {
    @IsOptional()
    @IsString()
    grade?: string;

    @IsOptional()
    @IsEnum(PlanType)
    type?: PlanType;

    @IsOptional()
    @IsEnum(PlanStatus)
    status?: PlanStatus;
}
