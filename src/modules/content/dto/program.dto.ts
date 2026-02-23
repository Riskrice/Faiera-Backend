import {
    IsString,
    IsOptional,
    IsEnum,
    IsInt,
    IsUrl,
    MaxLength,
    Min,
} from 'class-validator';
import { ProgramStatus } from '../entities/program.entity';
import { PaginationQueryDto } from '../../../common/dto';

export class CreateProgramDto {
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

    @IsString()
    @MaxLength(50)
    grade!: string;

    @IsString()
    @MaxLength(100)
    subject!: string;

    @IsOptional()
    @IsUrl()
    thumbnailUrl?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;
}

export class UpdateProgramDto {
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
    @MaxLength(50)
    grade?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    subject?: string;

    @IsOptional()
    @IsUrl()
    thumbnailUrl?: string;

    @IsOptional()
    @IsEnum(ProgramStatus)
    status?: ProgramStatus;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;
}

export class ProgramQueryDto extends PaginationQueryDto {
    @IsOptional()
    @IsString()
    grade?: string;

    @IsOptional()
    @IsString()
    subject?: string;

    @IsOptional()
    @IsEnum(ProgramStatus)
    status?: ProgramStatus;
}
