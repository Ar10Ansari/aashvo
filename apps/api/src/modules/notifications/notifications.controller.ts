import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/users.types';
import {
  GetNotificationsQueryDto,
  NotificationListResponseDto,
  NotificationResponseDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('User Notifications')
@ApiBearerAuth('BearerAuth')
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get caller in-app notifications with unread counts' })
  @ApiResponse({ status: 200, type: NotificationListResponseDto })
  async getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetNotificationsQueryDto,
  ): Promise<NotificationListResponseDto> {
    return this.notificationsService.getNotifications(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Fast count of unread notifications for badge display' })
  @ApiResponse({ status: 200, description: 'Unread notification count' })
  async getUnreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ unreadCount: number }> {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark single notification as read' })
  @ApiResponse({ status: 200, type: NotificationResponseDto })
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all caller notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; markedCount: number }> {
    return this.notificationsService.markAllAsRead(user.id);
  }
}
