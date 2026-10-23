import { apiData } from './api';

export type UnreadChannelSummary = {
  channelId: string;
  unread: number;
  mentions: number;
};

export type UnreadConversationSummary = {
  conversationId: string;
  unread: number;
};

export type UnreadSummary = {
  channels: UnreadChannelSummary[];
  conversations: UnreadConversationSummary[];
  totals: { unread: number; mentions: number };
};

export const getUnreadSummary = () => apiData<UnreadSummary>('/unread');

export const markChannelRead = (channelId: string) =>
  apiData<{ ok: boolean }>(`/channels/${channelId}/read`, { method: 'POST' });

export const markConversationRead = (conversationId: string) =>
  apiData<{ ok: boolean }>(`/conversations/${conversationId}/read`, { method: 'POST' });
