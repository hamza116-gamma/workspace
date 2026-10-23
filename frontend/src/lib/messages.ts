import { apiData } from './api';
import type { Message, PendingAttachment } from '@/types/message';

export type SendOptions = {
  parentMessageId?: string;
  alsoSendToChannel?: boolean;
  attachments?: PendingAttachment[];
};

// `after` pages newer messages back in (window trimmed at the newest end).
const withCursor = (path: string, before?: string, after?: string) =>
  after
    ? `${path}?after=${encodeURIComponent(after)}`
    : before
      ? `${path}?before=${encodeURIComponent(before)}`
      : path;

export const listChannelMessages = (channelId: string, before?: string, after?: string) =>
  apiData<{ messages: Message[] }>(withCursor(`/channels/${channelId}/messages`, before, after));

export const sendChannelMessage = (channelId: string, content: string, options: SendOptions = {}) =>
  apiData<{ message: Message }>(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: { content, ...options },
  });

export const listConversationMessages = (conversationId: string, before?: string, after?: string) =>
  apiData<{ messages: Message[] }>(
    withCursor(`/conversations/${conversationId}/messages`, before, after),
  );

export const sendConversationMessage = (
  conversationId: string,
  content: string,
  options: SendOptions = {},
) =>
  apiData<{ message: Message }>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: { content, ...options },
  });

export const updateMessage = (messageId: string, content: string) =>
  apiData<{ message: Message }>(`/messages/${messageId}`, {
    method: 'PATCH',
    body: { content },
  });

export const deleteMessage = (messageId: string) =>
  apiData<{ message: Message }>(`/messages/${messageId}`, { method: 'DELETE' });

export const toggleReaction = (messageId: string, emoji: string) =>
  apiData<{ message: Message }>(`/messages/${messageId}/reactions`, {
    method: 'POST',
    body: { emoji },
  });

export const getThread = (messageId: string) =>
  apiData<{ message: Message; replies: Message[]; following: boolean }>(
    `/messages/${messageId}/thread`,
  );

export const followThread = (messageId: string) =>
  apiData<{ following: boolean }>(`/messages/${messageId}/follow`, { method: 'POST' });

export const unfollowThread = (messageId: string) =>
  apiData<{ following: boolean }>(`/messages/${messageId}/follow`, { method: 'DELETE' });
