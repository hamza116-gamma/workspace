import type { User } from './user';

export type NotificationType = 'MENTION' | 'DM' | 'THREAD_REPLY' | 'CHANNEL';

export type NotificationItem = {
  id: string;
  type: NotificationType;
  actor: User;
  messageId: string;
  channelId: string | null;
  conversationId: string | null;
  snippet: string;
  readAt: string | null;
  createdAt: string;
};
