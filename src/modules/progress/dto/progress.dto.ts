import { IsEnum, IsUUID, IsNumber, IsOptional, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ContentType } from '../entities/progress.entity';

// ... (UpdateProgressDto remains same)

export class ProgressQueryDto {
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;

  @IsOptional()
  @IsUUID()
  contentId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

export class UpdateProgressDto {
  @IsEnum(ContentType)
  contentType!: ContentType;

  @IsUUID()
  contentId!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lastPosition?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDuration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpent?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
