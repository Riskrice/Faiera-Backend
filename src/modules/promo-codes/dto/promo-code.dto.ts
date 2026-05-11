import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, IsDateString, IsUUID, Min, Max, Length, Matches, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { DiscountType, PromoCodeScope } from '../entities/promo-code.entity';

export class CreatePromoCodeDto {
  @IsString()
  @Length(4, 20)
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'Code can only contain alphanumeric characters and dashes' })
  @Transform(({ value }) => (value as string).toUpperCase())
  code!: string;

  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @IsNumber()
  @Min(0.01)
  discountValue!: number;

  @ValidateIf(o => o.discountType === DiscountType.PERCENTAGE)
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  maxDiscountCap?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrderAmount?: number;

  @IsEnum(PromoCodeScope)
  scope!: PromoCodeScope;

  @ValidateIf(o => o.scope !== PromoCodeScope.GLOBAL)
  @IsUUID()
  scopeReferenceId?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTotalUses?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxUsesPerUser?: number;

  @IsDateString()
  startsAt!: Date;

  @IsDateString()
  @IsOptional()
  expiresAt?: Date;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  campaignTag?: string;

  @IsString()
  @IsOptional()
  descriptionInternal?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class GeneratePromoCodesDto {
  @IsNumber()
  @Min(1)
  @Max(1000)
  count!: number;

  @IsString()
  @Length(1, 10)
  @Matches(/^[A-Za-z0-9]+$/, { message: 'Prefix can only contain alphanumeric characters' })
  @Transform(({ value }) => (value as string).toUpperCase())
  @IsOptional()
  prefix?: string;

  @IsNumber()
  @Min(4)
  @Max(12)
  @IsOptional()
  codeLength?: number;

  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @IsNumber()
  @Min(0.01)
  discountValue!: number;

  @ValidateIf(o => o.discountType === DiscountType.PERCENTAGE)
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  maxDiscountCap?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrderAmount?: number;

  @IsEnum(PromoCodeScope)
  scope!: PromoCodeScope;

  @ValidateIf(o => o.scope !== PromoCodeScope.GLOBAL)
  @IsUUID()
  scopeReferenceId?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTotalUses?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxUsesPerUser?: number;

  @IsDateString()
  startsAt!: Date;

  @IsDateString()
  @IsOptional()
  expiresAt?: Date;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  campaignTag?: string;

  @IsString()
  @IsOptional()
  descriptionInternal?: string;
}

export class ValidatePromoCodeDto {
  @IsString()
  @Transform(({ value }) => (value as string).toUpperCase())
  code!: string;

  @IsUUID()
  @IsOptional()
  courseId?: string;

  @IsUUID()
  @IsOptional()
  planId?: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class UpdatePromoCodeDto {
  @IsEnum(DiscountType)
  @IsOptional()
  discountType?: DiscountType;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  discountValue?: number;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  maxDiscountCap?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrderAmount?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTotalUses?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxUsesPerUser?: number;

  @IsDateString()
  @IsOptional()
  expiresAt?: Date;

  @IsString()
  @IsOptional()
  campaignTag?: string;

  @IsString()
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
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number;
}
