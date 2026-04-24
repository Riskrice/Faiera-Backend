import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../database';

export enum VideoStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
  DELETED = 'deleted',
}

export enum VideoVisibility {
  PUBLIC = 'public',
  UNLISTED = 'unlisted',
  PRIVATE = 'private',
}

export enum VideoQuality {
  SD_360 = '360p',
  SD_480 = '480p',
  HD_720 = '720p',
  HD_1080 = '1080p',
  UHD_4K = '2160p',
}

@Entity('videos')
export class Video extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  titleAr!: string;

  @Column({ type: 'varchar', length: 255 })
  titleEn!: string;

  @Column({ type: 'text', nullable: true })
  descriptionAr?: string;

  @Column({ type: 'text', nullable: true })
  descriptionEn?: string;

  @Index()
  @Column({
    type: 'enum',
    enum: VideoStatus,
    default: VideoStatus.PENDING,
  })
  status!: VideoStatus;

  @Column({
    type: 'enum',
    enum: VideoVisibility,
    default: VideoVisibility.PRIVATE,
  })
  visibility!: VideoVisibility;

  // Content linking
  @Index()
  @Column({ type: 'uuid', nullable: true })
  lessonId?: string;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true })
  grade?: string;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  subject?: string;

  // Bunny.net metadata
  @Column({ type: 'varchar', length: 100 })
  bunnyVideoId!: string;

  @Column({ type: 'varchar', length: 100 })
  bunnyLibraryId!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bunnyCollectionId?: string;

  // Playback URLs
  @Column({ type: 'varchar', length: 500, nullable: true })
  hlsPlaylistUrl?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnailUrl?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  previewUrl?: string;

  // Video info
  @Column({ type: 'int', default: 0 })
  durationSeconds!: number;

  @Column({ type: 'bigint', default: 0 })
  fileSizeBytes!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  originalFilename?: string;

  // Encoding
  @Column({ type: 'simple-array', nullable: true })
  availableQualities?: string[];

  @Column({ type: 'boolean', default: false })
  hasCaption!: boolean;

  @Column({ type: 'simple-array', nullable: true })
  captionLanguages?: string[];

  // Stats
  @Column({ type: 'int', default: 0 })
  viewCount!: number;

  @Column({ type: 'int', default: 0 })
  uniqueViewers!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  avgWatchPercentage!: number;

  // Security
  @Column({ type: 'boolean', default: true })
  requiresAuth!: boolean;

  @Column({ type: 'boolean', default: true })
  requiresSubscription!: boolean;

  @Column({ type: 'int', default: 3600 })
  tokenExpirationSeconds!: number;

  // Upload info
  @Index()
  @Column({ type: 'uuid' })
  uploadedBy!: string;

  @Column({ type: 'timestamptz', nullable: true })
  encodingCompletedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
