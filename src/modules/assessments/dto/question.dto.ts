import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsArray,
  IsBoolean,
  IsUUID,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @IsOptional()
  @IsEnum(CognitiveLevel)
  cognitiveLevel?: CognitiveLevel;

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
  @IsInt()
  @Min(1)
  points?: number;

  @IsOptional()
  @IsBoolean()
  partialCredit?: boolean;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}

export class ReviewQuestionDto {
  @IsEnum(QuestionStatus)
  status!: QuestionStatus;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QuestionQueryDto extends PaginationQueryDto {
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
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
