import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsArray,
  IsBoolean,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  QuestionType,
  DifficultyLevel,
  CognitiveLevel,
  QuestionStatus,
} from '../entities/question.entity';

export class MCQOptionDto {
  @IsString()
  id!: string;

  @IsString()
  textAr!: string;

  @IsString()
  textEn!: string;

  @IsBoolean()
  isCorrect!: boolean;

  @IsOptional()
  @IsString()
  explanation?: string;
}

export class CreateQuestionDto {
  @IsString()
  questionAr!: string;

  @IsString()
  questionEn!: string;

  @IsOptional()
  @IsString()
  explanationAr?: string;

  @IsOptional()
  @IsString()
  explanationEn?: string;

  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsEnum(DifficultyLevel)
  difficulty!: DifficultyLevel;

  @IsOptional()
  @IsEnum(CognitiveLevel)
  cognitiveLevel?: CognitiveLevel;

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
  @IsString()
  subtopic?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // Answer data - structure depends on type
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MCQOptionDto)
  options?: MCQOptionDto[];

  @IsOptional()
  answerData?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  correctOrder?: string[];

  @IsOptional()
  @IsBoolean()
  correctAnswer?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedTimeSeconds?: number;

  @IsOptional()
  @IsBoolean()
  partialCredit?: boolean;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  audioUrl?: string;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  questionAr?: string;

  @IsOptional()
  @IsString()
  questionEn?: string;

  @IsOptional()
  @IsString()
  explanationAr?: string;

  @IsOptional()
  @IsString()
  explanationEn?: string;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @IsOptional()
  @IsEnum(CognitiveLevel)
  cognitiveLevel?: CognitiveLevel;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subject?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  subtopic?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MCQOptionDto)
  options?: MCQOptionDto[];

  @IsOptional()
  answerData?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  correctOrder?: string[];

  @IsOptional()
  @IsBoolean()
  correctAnswer?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedTimeSeconds?: number;

  @IsOptional()
  @IsBoolean()
  partialCredit?: boolean;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  audioUrl?: string;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;
}

export class ReviewQuestionDto {
  @IsEnum(QuestionStatus)
  status!: QuestionStatus;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export const questionSortableFields = [
  'createdAt',
  'difficulty',
  'usageCount',
  'correctRate',
  'avgTimeSeconds',
  'points',
] as const;

export type QuestionSortBy = (typeof questionSortableFields)[number];

export const questionSortOrders = ['ASC', 'DESC'] as const;

export type QuestionSortOrder = (typeof questionSortOrders)[number];

export class QuestionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return value;
    return Math.min(Math.max(Math.trunc(numeric), 1), 100);
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 100;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  subtopic?: string;

  @IsOptional()
  @IsEnum(CognitiveLevel)
  cognitiveLevel?: CognitiveLevel;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (Array.isArray(value)) {
      return value
        .map(item => String(item).trim())
        .filter(Boolean);
    }
    return String(value)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minCorrectRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minUsageCount?: number;

  @IsOptional()
  @IsIn(questionSortableFields)
  sortBy?: QuestionSortBy;

  @IsOptional()
  @Transform(({ value }) => String(value ?? '').toUpperCase())
  @IsIn(questionSortOrders)
  sortOrder?: QuestionSortOrder;
}
