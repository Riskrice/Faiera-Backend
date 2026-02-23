import { Entity, Column, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../database';
import { Lesson } from './lesson.entity';

export enum VideoStatus {
    PENDING = 'pending',       // Initial state, waiting for upload configuration
    UPLOADING = 'uploading',   // Upload URL generated
    PROCESSING = 'processing', // Uploaded, encoding in progress (webhook received)
    READY = 'ready',           // Ready for playback
    FAILED = 'failed',         // Encoding failed
}

@Entity('video_resources')
export class VideoResource extends BaseEntity {
    @Column({ type: 'varchar', length: 255 })
    title!: string;

    @Column({ type: 'varchar', length: 100 })
    bunnyVideoId!: string;

    @Column({ type: 'varchar', length: 100 })
    libraryId!: string;

    @Column({
        type: 'enum',
        enum: VideoStatus,
        default: VideoStatus.PENDING,
    })
    status!: VideoStatus;

    @Column({ type: 'int', default: 0 })
    durationSeconds!: number;

    @Column({ type: 'varchar', length: 500, nullable: true })
    thumbnailUrl?: string;

    @Column({ type: 'jsonb', nullable: true })
    meta?: Record<string, any>;

    @OneToOne(() => Lesson, lesson => lesson.video)
    lesson?: Lesson;
}
