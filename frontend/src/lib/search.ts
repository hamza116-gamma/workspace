import { apiData } from './api';
import type { SearchResult, SearchType } from '@/types/search';

export const searchWorkspace = (q: string, type: SearchType = 'all', page = 0) => {
  const params = new URLSearchParams({ q, type, page: String(page) });
  return apiData<SearchResult>(`/search?${params.toString()}`);
};

/** Link that opens a message in its chat (deep link + focus). */
export const messageHref = (
  target: { channelId: string | null; conversationId: string | null },
  messageId: string,
) =>
  target.channelId
    ? `/channels/${target.channelId}?message=${messageId}`
    : `/dm/${target.conversationId}?message=${messageId}`;
