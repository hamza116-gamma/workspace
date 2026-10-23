import { apiData } from './api';
import type { PinnedMessage } from '@/types/saved';

export const listChannelPins = (channelId: string) =>
  apiData<{ pins: PinnedMessage[] }>(`/channels/${channelId}/pins`);

export const pinMessage = (channelId: string, messageId: string) =>
  apiData<{ pinned: boolean; pin: PinnedMessage | null }>(
    `/channels/${channelId}/pins/${messageId}`,
    { method: 'POST' },
  );

export const unpinMessage = (channelId: string, messageId: string) =>
  apiData<{ pinned: boolean }>(`/channels/${channelId}/pins/${messageId}`, {
    method: 'DELETE',
  });
