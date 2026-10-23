import { apiData } from './api';
import type { NotificationItem } from '@/types/notification';

export const listNotifications = (options: { unreadOnly?: boolean } = {}) =>
  apiData<{ notifications: NotificationItem[]; unreadCount: number }>(
    `/notifications${options.unreadOnly ? '?unread=true' : ''}`,
  );

export const markNotificationRead = (id: string) =>
  apiData<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' });

export const markAllNotificationsRead = () =>
  apiData<{ ok: boolean }>('/notifications/read-all', { method: 'POST' });

export const removeNotification = (id: string) =>
  apiData<{ ok: boolean }>(`/notifications/${id}`, { method: 'DELETE' });

export type ActivitySummary = {
  threadsFollowed: number;
  threadsWithNewReplies: number;
  messagesToday: number;
  messagesYesterday: number;
};

export const getActivitySummary = () =>
  apiData<{ summary: ActivitySummary }>('/notifications/summary');
