import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { FileEntity, FileType, StorageProvider } from '../entities/file.entity';
import { UploadFileDto, FileQueryDto } from '../dto';

export interface UploadedFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
}

export interface ImageResizeOptions {
    width?: number;
    height?: number;
    quality?: number;
}

@Injectable()
export class UploadService {
    private readonly logger = new Logger(UploadService.name);
    private readonly uploadDir: string;
    private readonly maxFileSize: number;
    private readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    private readonly allowedDocTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    private readonly allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];

    constructor(
        @InjectRepository(FileEntity)
        private readonly fileRepository: Repository<FileEntity>,
        private readonly configService: ConfigService,
    ) {
        this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';
        this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE') || 10 * 1024 * 1024; // 10MB

        this.ensureUploadDir();
    }

    private async ensureUploadDir(): Promise<void> {
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
            await fs.mkdir(path.join(this.uploadDir, 'images'), { recursive: true });
            await fs.mkdir(path.join(this.uploadDir, 'documents'), { recursive: true });
            await fs.mkdir(path.join(this.uploadDir, 'videos'), { recursive: true });
        } catch (error) {
            this.logger.error('Failed to create upload directories', error);
        }
    }

    async uploadFile(
        file: UploadedFile,
        uploaderId: string,
        dto?: UploadFileDto,
    ): Promise<FileEntity> {
        this.validateFile(file);

        const fileType = this.getFileType(file.mimetype);
        const ext = this.safeExtensionForMime(file.mimetype, file.originalname);
        const fileName = `${uuidv4()}${ext}`;
        const subDir = this.getSubDir(fileType);
        const filePath = path.join(this.uploadDir, subDir, fileName);

        await fs.writeFile(filePath, file.buffer);

        const fileEntity = this.fileRepository.create({
            originalName: file.originalname,
            fileName,
            mimeType: file.mimetype,
            fileType,
            size: file.size,
            path: filePath,
            // For local files, we don't store the URL to allow dynamic base URL changes
            url: null,
            storageProvider: StorageProvider.LOCAL,
            uploadedBy: uploaderId,
            entityType: dto?.entityType,
            entityId: dto?.entityId,
            isPublic: dto?.isPublic ?? false,
        });

        await this.fileRepository.save(fileEntity);
        this.logger.log(`File uploaded: ${fileName} by user ${uploaderId}`);

        return fileEntity;
    }

    async uploadImage(
        file: UploadedFile,
        uploaderId: string,
        dto?: UploadFileDto,
        resizeOptions?: ImageResizeOptions,
    ): Promise<FileEntity> {
        if (!this.allowedImageTypes.includes(file.mimetype)) {
            throw new BadRequestException('Invalid image type. Allowed: JPEG, PNG, GIF, WebP');
        }

        const ext = '.webp'; // Convert all images to WebP for optimization
        const fileName = `${uuidv4()}${ext}`;
        const filePath = path.join(this.uploadDir, 'images', fileName);

        // Process image with sharp
        let sharpInstance = sharp(file.buffer);

        if (resizeOptions?.width || resizeOptions?.height) {
            sharpInstance = sharpInstance.resize(resizeOptions.width, resizeOptions.height, {
                fit: 'inside',
                withoutEnlargement: true,
            });
        }

        const processedBuffer = await sharpInstance
            .webp({ quality: resizeOptions?.quality || 85 })
            .toBuffer();

        const metadata = await sharp(processedBuffer).metadata();

        await fs.writeFile(filePath, processedBuffer);

        const fileEntity = this.fileRepository.create({
            originalName: file.originalname,
            fileName,
            mimeType: 'image/webp',
            fileType: FileType.IMAGE,
            size: processedBuffer.length,
            path: filePath,
            // For local files, we don't store the URL to allow dynamic base URL changes
            url: null,
            storageProvider: StorageProvider.LOCAL,
            uploadedBy: uploaderId,
            entityType: dto?.entityType,
            entityId: dto?.entityId,
            isPublic: dto?.isPublic ?? false,
            metadata: {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                originalSize: file.size,
            },
        });

        await this.fileRepository.save(fileEntity);
        this.logger.log(`Image uploaded and optimized: ${fileName}`);

        return fileEntity;
    }

    async uploadMultiple(
        files: UploadedFile[],
        uploaderId: string,
        dto?: UploadFileDto,
    ): Promise<FileEntity[]> {
        const results: FileEntity[] = [];

        for (const file of files) {
            const isImage = this.allowedImageTypes.includes(file.mimetype);
            const result = isImage
                ? await this.uploadImage(file, uploaderId, dto)
                : await this.uploadFile(file, uploaderId, dto);
            results.push(result);
        }

        return results;
    }

    async getFile(fileId: string): Promise<FileEntity> {
        const file = await this.fileRepository.findOne({ where: { id: fileId } });
        if (!file) {
            throw new NotFoundException('File not found');
        }
        return file;
    }

    async getFiles(query: FileQueryDto, uploaderId?: string): Promise<FileEntity[]> {
        const where: FindOptionsWhere<FileEntity> = {};

        if (query.fileType) where.fileType = query.fileType;
        if (query.entityType) where.entityType = query.entityType;
        if (query.entityId) where.entityId = query.entityId;
        if (query.uploadedBy) where.uploadedBy = query.uploadedBy;
        if (uploaderId) where.uploadedBy = uploaderId;

        return this.fileRepository.find({
            where,
            order: { createdAt: 'DESC' },
            take: 100,
        });
    }

    async deleteFile(fileId: string, requesterId: string): Promise<void> {
        const file = await this.getFile(fileId);

        // Check ownership
        if (file.uploadedBy !== requesterId) {
            throw new BadRequestException('You can only delete your own files');
        }

        // Delete from storage
        try {
            await fs.unlink(file.path);
        } catch (error) {
            this.logger.warn(`Failed to delete file from storage: ${file.path}`);
        }

        await this.fileRepository.remove(file);
        this.logger.log(`File deleted: ${file.fileName}`);
    }

    async deleteByEntity(entityType: string, entityId: string): Promise<number> {
        const files = await this.fileRepository.find({
            where: { entityType, entityId },
        });

        for (const file of files) {
            try {
                await fs.unlink(file.path);
            } catch (error) {
                this.logger.warn(`Failed to delete file: ${file.path}`);
            }
        }

        const result = await this.fileRepository.delete({ entityType, entityId });
        return result.affected || 0;
    }

    private validateFile(file: UploadedFile): void {
        if (file.size > this.maxFileSize) {
            throw new BadRequestException(
                `File too large. Maximum size: ${this.maxFileSize / 1024 / 1024}MB`,
            );
        }

        const allowedTypes = [
            ...this.allowedImageTypes,
            ...this.allowedDocTypes,
            ...this.allowedVideoTypes,
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            throw new BadRequestException('File type not allowed');
        }
    }

    private getFileType(mimeType: string): FileType {
        if (this.allowedImageTypes.includes(mimeType)) return FileType.IMAGE;
        if (this.allowedVideoTypes.includes(mimeType)) return FileType.VIDEO;
        if (this.allowedDocTypes.includes(mimeType)) return FileType.DOCUMENT;
        if (mimeType.startsWith('audio/')) return FileType.AUDIO;
        return FileType.OTHER;
    }

    private getSubDir(fileType: FileType): string {
        switch (fileType) {
            case FileType.IMAGE: return 'images';
            case FileType.VIDEO: return 'videos';
            case FileType.DOCUMENT: return 'documents';
            default: return 'other';
        }
    }

    /** Map MIME type to a safe canonical extension, falling back to original only if it matches. */
    private safeExtensionForMime(mimeType: string, originalName: string): string {
        const mimeToExt: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'application/pdf': '.pdf',
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'video/quicktime': '.mov',
        };

        return mimeToExt[mimeType] || path.extname(originalName).toLowerCase() || '.bin';
    }
}
