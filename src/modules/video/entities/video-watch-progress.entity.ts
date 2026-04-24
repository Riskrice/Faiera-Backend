import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../database';
import { Video } from './video.entity';

@Entity('video_watch_progress')
@Unique(['videoId', 'userId'])
export class VideoWatchProgress extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  videoId!: string;

  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'videoId' })
  video!: Video;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'int', default: 0 })
  lastPositionSeconds!: number;

  @Column({ type: 'int', default: 0 })
  totalWatchedSeconds!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  completionPercentage!: number;

  @Column({ type: 'boolean', default: false })
  isCompleted!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastWatchedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ type: 'int', default: 0 })
  watchCount!: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  lastQuality?: string;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 1 })
  lastPlaybackSpeed!: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
