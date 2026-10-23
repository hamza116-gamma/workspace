'use client';

import { useCallback } from 'react';
import { useChannels } from './useChannels';
import { setMyChannelPreferences } from '@/lib/channels';
import type { Channel } from '@/types/channel';

const withStar = (channel: Channel, starred: boolean): Channel =>
  channel.membership ? { ...channel, membership: { ...channel.membership, starred } } : channel;

/** Persisted star toggle (optimistic, rolled back on failure). */
export const useChannelStar = () => {
  const { channels, patchChannel } = useChannels();

  const isStarred = useCallback(
    (channelId: string) =>
      Boolean(channels.find((channel) => channel.id === channelId)?.membership?.starred),
    [channels],
  );

  const setStarred = useCallback(
    async (channelId: string, starred: boolean) => {
      patchChannel(channelId, (channel) => withStar(channel, starred));
      try {
        await setMyChannelPreferences(channelId, { starred });
      } catch (err) {
        patchChannel(channelId, (channel) => withStar(channel, !starred));
        throw err;
      }
    },
    [patchChannel],
  );

  return { isStarred, setStarred };
};
