import { apiData } from './api';
import type { MessageLink } from '@/types/link';

export const listChannelLinks = (channelId: string) =>
  apiData<{ links: MessageLink[] }>(`/channels/${channelId}/links`);

export const listConversationLinks = (conversationId: string) =>
  apiData<{ links: MessageLink[] }>(`/conversations/${conversationId}/links`);
