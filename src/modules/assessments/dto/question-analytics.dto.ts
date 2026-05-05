import { IsOptional, IsString, IsUUID } from 'class-validator';

export class QuestionAnalyticsQueryDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  subject?: string;
}
