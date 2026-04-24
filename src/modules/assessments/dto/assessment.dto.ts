import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsArray,
  IsBoolean,
  IsUUID,
  IsDate,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssessmentType, ShuffleMode } from '../entities/assessment.entity';

export class CreateAssessmentDto {
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
  @IsString()
  instructionsAr?: string;

  @IsOptional()
  @IsString()
  instructionsEn?: string;

  @IsEnum(AssessmentType)
  type!: AssessmentType;

  @IsString()
  @MaxLength(50)
  grade!: string;

  @IsString()
  @MaxLength(100)
  subject!: string;

  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @IsOptional()
  @IsUUID()
  moduleId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimitMinutes?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsBoolean()
  allowRetake?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passingScore?: number;

  @IsOptional()
  @IsBoolean()
  showScoreImmediately?: boolean;

  @IsOptional()
  @IsBoolean()
  showCorrectAnswers?: boolean;

  @IsOptional()
  @IsBoolean()
  showExplanations?: boolean;

  @IsOptional()
  @IsEnum(ShuffleMode)
  shuffleMode?: ShuffleMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  questionPoolSize?: number;

  @IsOptional()
  @IsBoolean()
  preventCopyPaste?: boolean;

  @IsOptional()
  @IsBoolean()
  lockBrowser?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  questionIds?: string[];
}

export class UpdateAssessmentDto {
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
  instructionsAr?: string;

  @IsOptional()
  @IsString()
  instructionsEn?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimitMinutes?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passingScore?: number;

  @IsOptional()
  @IsBoolean()
  showScoreImmediately?: boolean;

  @IsOptional()
  @IsBoolean()
  showCorrectAnswers?: boolean;

  @IsOptional()
  @IsEnum(ShuffleMode)
  shuffleMode?: ShuffleMode;

  @IsOptional()
  @IsBoolean()
  showExplanations?: boolean;

  @IsOptional()
  @IsBoolean()
  preventCopyPaste?: boolean;

  @IsOptional()
  @IsBoolean()
  lockBrowser?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  questionPoolSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subject?: string;
}

export class AddQuestionsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  questionIds!: string[];
}

export class AssessmentQueryDto {
  @IsOptional()
  @IsEnum(AssessmentType)
  type?: AssessmentType;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
