import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService, UploadedFile as IUploadedFile } from '../services/upload.service';
import { UploadFileDto, FileQueryDto, FileResponseDto } from '../dto';
import { CurrentUser, Roles } from '../../auth/decorators';
import { Role } from '../../auth/constants/roles.constant';
import { FileEntity } from '../entities/file.entity';
import { ConfigService } from '@nestjs/config';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards';

const multerOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
};

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  private readonly baseUrl: string;

  constructor(
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser('sub') userId: string,
    @Body() dto: UploadFileDto,
  ): Promise<FileResponseDto> {
    const uploaded = await this.uploadService.uploadFile(file, userId, dto);
    return this.toResponseDto(uploaded);
  }

  @Post('image')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser('sub') userId: string,
    @Body() dto: UploadFileDto,
    @Query('width') width?: string,
    @Query('height') height?: string,
  ): Promise<FileResponseDto> {
    const uploaded = await this.uploadService.uploadImage(file, userId, dto, {
      width: width ? parseInt(width, 10) : undefined,
      height: height ? parseInt(height, 10) : undefined,
    });
    return this.toResponseDto(uploaded);
  }

  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('sub') userId: string,
    @Body() dto: UploadFileDto,
  ): Promise<FileResponseDto[]> {
    const uploaded = await this.uploadService.uploadMultiple(files, userId, dto);
    return uploaded.map(f => this.toResponseDto(f));
  }

  @Get()
  async getMyFiles(
    @CurrentUser('sub') userId: string,
    @Query() query: FileQueryDto,
  ): Promise<FileResponseDto[]> {
    const files = await this.uploadService.getFiles(query, userId);
    return files.map(f => this.toResponseDto(f));
  }

  @Get(':id')
  async getFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ): Promise<FileResponseDto> {
    const file = await this.uploadService.getFile(id);
    // Only allow access to own files or public files
    if (!file.isPublic && file.uploadedBy !== userId) {
      throw new NotFoundException('File not found');
    }
    return this.toResponseDto(file);
  }

  @Delete(':id')
  async deleteFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.uploadService.deleteFile(id, userId);
    return { success: true, message: 'File deleted successfully' };
  }

  @Delete('entity/:entityType/:entityId')
  @Roles(Role.ADMIN)
  async deleteByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ): Promise<{ success: boolean; deleted: number }> {
    const deleted = await this.uploadService.deleteByEntity(entityType, entityId);
    return { success: true, deleted };
  }

  private toResponseDto(file: FileEntity): FileResponseDto {
    let url = file.url || '';

    // For local files, always reconstruct the URL dynamically to handle base URL changes
    // and fix legacy files with incorrect stored URLs
    if (file.storageProvider === 'local') {
      let subDir = 'other';
      // Determine subdir based on file type (matching UploadService logic)
      if (file.fileType === 'image') subDir = 'images';
      else if (file.fileType === 'video') subDir = 'videos';
      else if (file.fileType === 'document') subDir = 'documents';

      url = `${this.baseUrl}/uploads/${subDir}/${file.fileName}`;
    }

    return {
      id: file.id,
      originalName: file.originalName,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileType: file.fileType,
      size: file.size,
      url,
      isPublic: file.isPublic,
      createdAt: file.createdAt,
    };
  }
}
