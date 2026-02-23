import {
    IsString,
    IsOptional,
    IsEnum,
    IsUUID,
    IsBoolean,
    IsArray,
    IsDate,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
    NotificationType,
    NotificationChannel,
    NotificationPriority,
} from '../entities/notification.entity';

export class SendNotificationDto {
    @IsUUID()
    userId!: string;

    @IsEnum(NotificationType)
    type!: NotificationType;

    @IsOptional()
    @IsEnum(NotificationChannel)
    channel?: NotificationChannel;

    @IsOptional()
    @IsEnum(NotificationPriority)
    priority?: NotificationPriority;

    @IsString()
    @MaxLength(255)
    titleAr!: string;

    @IsString()
    @MaxLength(255)
    titleEn!: string;

    @IsString()
    bodyAr!: string;

    @IsString()
    bodyEn!: string;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsString()
    actionUrl?: string;

    @IsOptional()
    @IsString()
    actionType?: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    scheduledAt?: Date;

    @IsOptional()
    @IsString()
    entityType?: string;

    @IsOptional()
    @IsUUID()
    entityId?: string;

    @IsOptional()
    data?: Record<string, unknown>;
}

export class SendBulkNotificationDto {
    @IsArray()
    @IsUUID('4', { each: true })
    userIds!: string[];

    @IsEnum(NotificationType)
    type!: NotificationType;

    @IsString()
    @MaxLength(255)
    titleAr!: string;

    @IsString()
    @MaxLength(255)
    titleEn!: string;

    @IsString()
    bodyAr!: string;

    @IsString()
    bodyEn!: string;

    @IsOptional()
    @IsString()
    actionUrl?: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    scheduledAt?: Date;
}

export class SendTemplateNotificationDto {
    @IsUUID()
    userId!: string;

    @IsString()
    templateCode!: string;

    @IsOptional()
    variables?: Record<string, string>;

    @IsOptional()
    @IsEnum(NotificationChannel)
    channel?: NotificationChannel;

    @IsOptional()
    @IsString()
    actionUrl?: string;

    @IsOptional()
    @IsString()
    entityType?: string;

    @IsOptional()
    @IsUUID()
    entityId?: string;
}

export class UpdatePreferencesDto {
    @IsOptional()
    @IsBoolean()
    inAppEnabled?: boolean;

    @IsOptional()
    @IsBoolean()
    pushEnabled?: boolean;

    @IsOptional()
    @IsBoolean()
    emailEnabled?: boolean;

    @IsOptional()
    @IsBoolean()
    smsEnabled?: boolean;

    @IsOptional()
    @IsBoolean()
    sessionReminders?: boolean;

    @IsOptional()
    @IsBoolean()
    bookingUpdates?: boolean;

    @IsOptional()
    @IsBoolean()
    assessmentAlerts?: boolean;

    @IsOptional()
    @IsBoolean()
    marketing?: boolean;

    @IsOptional()
    @IsBoolean()
    quietHoursEnabled?: boolean;

    @IsOptional()
    @IsString()
    quietHoursStart?: string;

    @IsOptional()
    @IsString()
    quietHoursEnd?: string;

    @IsOptional()
    @IsString()
    preferredLanguage?: string;
}

import { PaginationQueryDto } from '../../../common/dto';

export class NotificationQueryDto extends PaginationQueryDto {
    @IsOptional()
    @IsEnum(NotificationType)
    type?: NotificationType;

    @IsOptional()
    @IsBoolean()
    unreadOnly?: boolean;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    fromDate?: Date;
}
