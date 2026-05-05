import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateQuestionCategoryDto {
  @IsString()
  @MaxLength(255)
  nameAr!: string;

  @IsString()
  @MaxLength(255)
  nameEn!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateQuestionCategoryDto {
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
  description?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
