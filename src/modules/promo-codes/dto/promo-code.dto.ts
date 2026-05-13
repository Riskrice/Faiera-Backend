import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsUUID,
  Min,
  Max,
  Length,
  Matches,
  ValidateIf,
  IsObject,
  MaxLength,
  IsInt,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DiscountType, PromoCodeScope } from '../entities/promo-code.entity';

const normalizeCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const normalizeOptionalString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toOptionalInteger = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  return Number.parseInt(String(value), 10);
};

export class CreatePromoCodeDto {
  @IsString()
  @Length(4, 50)
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'Code can only contain alphanumeric characters and dashes' })
  @Transform(normalizeCode)
  code!: string;

  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  discountValue!: number;

  @ValidateIf(o => o.discountType === DiscountType.PERCENTAGE)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  maxDiscountCap?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrderAmount?: number;

  @IsEnum(PromoCodeScope)
  scope!: PromoCodeScope;

  @ValidateIf(o => o.scope !== PromoCodeScope.GLOBAL)
  @IsUUID()
  scopeReferenceId?: string;

  @Type(() => Number)
  @IsInt()
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTotalUses?: number;

  @Type(() => Number)
  @IsInt()
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxUsesPerUser?: number;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @MaxLength(100)
  @Transform(normalizeOptionalString)
  @IsOptional()
  campaignTag?: string;

  @IsString()
  @Transform(normalizeOptionalString)
  @IsOptional()
  descriptionInternal?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class GeneratePromoCodesDto {
  @Type(() => Number)
  @IsInt()
  @IsNumber()
  @Min(1)
  @Max(1000)
  count!: number;

  @IsString()
  @Length(1, 10)
  @Matches(/^[A-Za-z0-9]+$/, { message: 'Prefix can only contain alphanumeric characters' })
  @Transform(normalizeCode)
  @IsOptional()
  prefix?: string;

  @Type(() => Number)
  @IsInt()
  @IsNumber()
  @Min(4)
  @Max(12)
  @IsOptional()
  codeLength?: number;

  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  discountValue!: number;

  @ValidateIf(o => o.discountType === DiscountType.PERCENTAGE)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  maxDiscountCap?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrderAmount?: number;

  @IsEnum(PromoCodeScope)
  scope!: PromoCodeScope;

  @ValidateIf(o => o.scope !== PromoCodeScope.GLOBAL)
  @IsUUID()
  scopeReferenceId?: string;

  @Type(() => Number)
  @IsInt()
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTotalUses?: number;

  @Type(() => Number)
  @IsInt()
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxUsesPerUser?: number;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @MaxLength(100)
  @Transform(normalizeOptionalString)
  @IsOptional()
  campaignTag?: string;

  @IsString()
  @Transform(normalizeOptionalString)
  @IsOptional()
  descriptionInternal?: string;
}

export class ValidatePromoCodeDto {
  @IsString()
  @Length(4, 50)
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'Code can only contain alphanumeric characters and dashes' })
  @Transform(normalizeCode)
  code!: string;

  @IsUUID()
  @IsOptional()
  courseId?: string;

  @IsUUID()
  @IsOptional()
  planId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class UpdatePromoCodeDto {
  @IsEnum(DiscountType)
  @IsOptional()
  discountType?: DiscountType;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  discountValue?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  maxDiscountCap?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrderAmount?: number;

  @Type(() => Number)
  @IsInt()
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTotalUses?: number;

  @Type(() => Number)
  @IsInt()
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxUsesPerUser?: number;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsString()
  @MaxLength(100)
  @Transform(normalizeOptionalString)
  @IsOptional()
  campaignTag?: string;

  @IsString()
  @Transform(normalizeOptionalString)
  @IsOptional()
  descriptionInternal?: string;
}

export class QueryPromoCodesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(PromoCodeScope)
  scope?: PromoCodeScope;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @IsOptional()
  @IsString()
  campaignTag?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toOptionalInteger)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(toOptionalInteger)
  limit?: number;
}

export class PromoCodeRedemptionsQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(toOptionalInteger)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(toOptionalInteger)
  limit?: number;
}
