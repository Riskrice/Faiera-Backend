import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../database';
import { NotificationType, NotificationChannel } from './notification.entity';

@Entity('notification_templates')
export class NotificationTemplate extends BaseEntity {
    @Index({ unique: true })
    @Column({ type: 'varchar', length: 100 })
    code!: string;

    @Column({
        type: 'enum',
        enum: NotificationType,
    })
    type!: NotificationType;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ type: 'text', nullable: true })
    description?: string;

    // Templates
    @Column({ type: 'varchar', length: 255 })
    titleAr!: string;

    @Column({ type: 'varchar', length: 255 })
    titleEn!: string;

    @Column({ type: 'text' })
    bodyAr!: string;

    @Column({ type: 'text' })
    bodyEn!: string;

    // Email specific
    @Column({ type: 'text', nullable: true })
    emailHtmlAr?: string;

    @Column({ type: 'text', nullable: true })
    emailHtmlEn?: string;

    // Push specific
    @Column({ type: 'varchar', length: 255, nullable: true })
    pushTitleAr?: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    pushTitleEn?: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    pushBodyAr?: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    pushBodyEn?: string;

    // Channels this template supports
    @Column({ type: 'simple-array' })
    channels!: NotificationChannel[];

    @Column({ type: 'simple-array', nullable: true })
    variables?: string[];

    @Column({ type: 'boolean', default: true })
    isActive!: boolean;
}
