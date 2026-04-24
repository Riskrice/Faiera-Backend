import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';
import {
  SendNotificationDto,
  SendBulkNotificationDto,
  SendTemplateNotificationDto,
  UpdatePreferencesDto,
  NotificationQueryDto,
} from '../dto';
import { Notification, NotificationPreference } from '../entities';
import {
  createSuccessResponse,
  createPaginatedResponse,
  ApiResponse,
  PaginatedResponse,
} from '../../../common/dto';
import { JwtAuthGuard, RbacGuard, Roles, CurrentUser, JwtPayload } from '../../auth';
import { Role } from '../../auth/constants/roles.constant';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RbacGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ==================== Admin Endpoints ====================

  @Post('send')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async send(@Body() dto: SendNotificationDto): Promise<ApiResponse<Notification>> {
    const notification = await this.notificationsService.send(dto);
    return createSuccessResponse(notification, 'Notification sent');
  }

  @Post('send/bulk')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async sendBulk(@Body() dto: SendBulkNotificationDto): Promise<ApiResponse<{ count: number }>> {
    const count = await this.notificationsService.sendBulk(dto);
    return createSuccessResponse({ count }, `Sent to ${count} users`);
  }

  @Post('send/template')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async sendFromTemplate(
    @Body() dto: SendTemplateNotificationDto,
  ): Promise<ApiResponse<Notification>> {
    const notification = await this.notificationsService.sendFromTemplate(dto);
    return createSuccessResponse(notification, 'Notification sent');
  }

  // ==================== User Endpoints ====================

  @Get()
  async getMyNotifications(
    @CurrentUser() user: JwtPayload,
    @Query() query: NotificationQueryDto,
  ): Promise<PaginatedResponse<Notification> & { unreadCount: number }> {
    const { notifications, total, unreadCount } =
      await this.notificationsService.getUserNotifications(
        user.sub,
        query,
        query, // NotificationQueryDto now extends PaginationQueryDto
      );

    return {
      ...createPaginatedResponse(notifications, query.page || 1, query.pageSize || 20, total),
      unreadCount,
    };
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: JwtPayload): Promise<ApiResponse<{ count: number }>> {
    const count = await this.notificationsService.getUnreadCount(user.sub);
    return createSuccessResponse({ count });
  }

  @Post(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<Notification>> {
    const notification = await this.notificationsService.markAsRead(id, user.sub);
    return createSuccessResponse(notification);
  }

  @Post('read-all')
  async markAllAsRead(@CurrentUser() user: JwtPayload): Promise<ApiResponse<{ count: number }>> {
    const count = await this.notificationsService.markAllAsRead(user.sub);
    return createSuccessResponse({ count }, `Marked ${count} as read`);
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<null>> {
    await this.notificationsService.deleteNotification(id, user.sub);
    return createSuccessResponse(null, 'Notification deleted');
  }

  // ==================== Preferences ====================

  @Get('preferences')
  async getPreferences(
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<NotificationPreference>> {
    const preferences = await this.notificationsService.getPreferences(user.sub);
    return createSuccessResponse(preferences);
  }

  @Put('preferences')
  async updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<NotificationPreference>> {
    const preferences = await this.notificationsService.updatePreferences(user.sub, dto);
    return createSuccessResponse(preferences, 'Preferences updated');
  }
}
