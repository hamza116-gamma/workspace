import { apiData } from './api';
import type { SavedMessage } from '@/types/saved';

export const listBookmarks = () => apiData<{ bookmarks: SavedMessage[] }>('/bookmarks');

export const saveMessage = (messageId: string) =>
  apiData<{ saved: boolean; bookmark: SavedMessage | null }>(`/bookmarks/${messageId}`, {
    method: 'POST',
  });

export const unsaveMessage = (messageId: string) =>
  apiData<{ saved: boolean }>(`/bookmarks/${messageId}`, { method: 'DELETE' });
