import { IsOptional, IsString, IsBoolean, IsEnum, IsUUID } from 'class-validator';
import { FileType } from '../entities/file.entity';

export class UploadFileDto {
    @IsOptional()
    @IsString()
    entityType?: string;

    @IsOptional()
    @IsUUID()
    entityId?: string;

    @IsOptional()
    @IsBoolean()
    isPublic?: boolean;
}

export class FileQueryDto {
    @IsOptional()
    @IsEnum(FileType)
    fileType?: FileType;

    @IsOptional()
    @IsString()
    entityType?: string;

    @IsOptional()
    @IsUUID()
    entityId?: string;

    @IsOptional()
    @IsUUID()
    uploadedBy?: string;
}

export class FileResponseDto {
    id!: string;
    originalName!: string;
    fileName!: string;
    mimeType!: string;
    fileType!: FileType;
    size!: number;
    url!: string;
    isPublic!: boolean;
    createdAt!: Date;
}
