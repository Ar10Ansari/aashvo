import { apiClient } from './apiClient';
import type { NotificationCategory, NotificationItem, NotificationListResponse } from '@aashvo/contracts';

class NotificationService {
  /**
   * Retrieves notification feed with pagination and filters.
   */
  async getNotifications(
    category?: NotificationCategory,
    unreadOnly?: boolean,
    limit = 20,
    offset = 0,
  ): Promise<NotificationListResponse> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (unreadOnly) params.append('unreadOnly', 'true');
    params.append('limit', String(limit));
    params.append('offset', String(offset));

    return apiClient.get<NotificationListResponse>(`/notifications?${params.toString()}`);
  }

  /**
   * Gets unread notification count for badge display.
   */
  async getUnreadCount(): Promise<{ unreadCount: number }> {
    return apiClient.get<{ unreadCount: number }>('/notifications/unread-count');
  }

  /**
   * Marks a single notification as read.
   */
  async markAsRead(notificationId: string): Promise<NotificationItem> {
    return apiClient.patch<NotificationItem>(`/notifications/${encodeURIComponent(notificationId)}/read`);
  }

  /**
   * Marks all unread notifications as read.
   */
  async markAllAsRead(): Promise<{ success: boolean; markedCount: number }> {
    return apiClient.post<{ success: boolean; markedCount: number }>('/notifications/read-all');
  }
}

export const notificationService = new NotificationService();

