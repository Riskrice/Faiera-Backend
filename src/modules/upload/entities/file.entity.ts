import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

export enum FileType {
    IMAGE = 'image',
    VIDEO = 'video',
    DOCUMENT = 'document',
    AUDIO = 'audio',
    OTHER = 'other',
}

export enum StorageProvider {
    LOCAL = 'local',
    S3 = 's3',
    BUNNY = 'bunny',
}

@Entity('files')
@Index(['uploadedBy'])
@Index(['entityType', 'entityId'])
export class FileEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    originalName!: string;

    @Column()
    fileName!: string;

    @Column()
    mimeType!: string;

    @Column({
        type: 'enum',
        enum: FileType,
    })
    fileType!: FileType;

    @Column({ type: 'int' })
    size!: number; // in bytes

    @Column()
    path!: string;

    @Column({ type: 'varchar', nullable: true })
    url!: string | null;

    @Column({
        type: 'enum',
        enum: StorageProvider,
        default: StorageProvider.LOCAL,
    })
    storageProvider!: StorageProvider;

    @Column('uuid', { nullable: true })
    uploadedBy!: string | null;

    @Column({ type: 'varchar', nullable: true })
    entityType!: string | null; // e.g., 'user', 'course', 'lesson'

    @Column('uuid', { nullable: true })
    entityId!: string | null;

    @Column({ type: 'jsonb', nullable: true })
    metadata!: Record<string, unknown> | null; // width, height, duration, etc.

    @Column({ default: false })
    isPublic!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    // Helper methods
    isImage(): boolean {
        return this.fileType === FileType.IMAGE;
    }

    getPublicUrl(baseUrl: string): string {
        if (this.url) return this.url;
        return `${baseUrl}/uploads/${this.fileName}`;
    }

    getSizeFormatted(): string {
        const kb = this.size / 1024;
        if (kb < 1024) return `${kb.toFixed(2)} KB`;
        return `${(kb / 1024).toFixed(2)} MB`;
    }
}
