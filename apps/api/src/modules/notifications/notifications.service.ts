import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type {
  GetNotificationsQueryDto,
  NotificationListResponseDto,
  NotificationResponseDto,
} from './dto/notification.dto';
import type { NotificationCategory } from '@aashvo/contracts';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(params: {
    userId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    targetUrl?: string;
    metadata?: Record<string, any>;
  }): Promise<NotificationResponseDto> {
    const item = await this.prisma.userNotification.create({
      data: {
        userId: params.userId,
        category: params.category,
        title: params.title,
        body: params.body,
        targetUrl: params.targetUrl,
        metadata: params.metadata ?? {},
      },
    });

    return this.mapToDto(item);
  }

  async getNotifications(
    userId: string,
    query?: GetNotificationsQueryDto,
  ): Promise<NotificationListResponseDto> {
    const limit = Math.min(query?.limit ?? 20, 50);

    const [items, unreadCount, total] = await Promise.all([
      this.prisma.userNotification.findMany({
        where: {
          userId,
          ...(query?.unreadOnly ? { read: false } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.userNotification.count({
        where: { userId, read: false },
      }),
      this.prisma.userNotification.count({
        where: { userId },
      }),
    ]);

    return {
      items: items.map((i) => this.mapToDto(i)),
      unreadCount,
      total,
    };
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.prisma.userNotification.count({
      where: { userId, read: false },
    });
    return { unreadCount };
  }

  async markAsRead(userId: string, notificationId: string): Promise<NotificationResponseDto> {
    const item = await this.prisma.userNotification.findUnique({
      where: { id: notificationId },
    });

    if (!item) {
      throw new NotFoundException('Notification not found.');
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('You are not authorized to modify this notification.');
    }

    const updated = await this.prisma.userNotification.update({
      where: { id: notificationId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return this.mapToDto(updated);
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean; markedCount: number }> {
    const res = await this.prisma.userNotification.updateMany({
      where: { userId, read: false },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return { success: true, markedCount: res.count };
  }

  private mapToDto(item: any): NotificationResponseDto {
    return {
      id: item.id,
      userId: item.userId,
      title: item.title,
      body: item.body,
      category: item.category,
      targetUrl: item.targetUrl,
      metadata: item.metadata as Record<string, any>,
      read: item.read,
      readAt: item.readAt ? item.readAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
    };
  }
}

