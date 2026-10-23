'use client';

import { createContext, useMemo } from 'react';
import { useChannels } from '@/hooks/useChannels';
import { useChatDetails } from '@/hooks/useChatDetails';
import { dropChat, fetchChannelDetails, peekChannel } from '@/lib/chatCache';
import type { Channel } from '@/types/channel';

type ActiveChannelValue = {
  channel: Channel | null;
  /** The channel id last requested with load() (null after clear()). */
  targetId: string | null;
  loading: boolean;
  error: string;
  load: (channelId: string) => void;
  reload: () => Promise<void>;
  clear: () => void;
};

export const ActiveChannelContext = createContext<ActiveChannelValue | null>(null);

export const ActiveChannelProvider = ({ children }: { children: React.ReactNode }) => {
  const { channels } = useChannels();
  // Header seed: the chat cache, else the sidebar's copy of the channel.
  const { item, targetId, loading, error, load, reload, clear } = useChatDetails<Channel>({
    fetch: fetchChannelDetails,
    seed: (id) => peekChannel(id) ?? channels.find((channel) => channel.id === id),
    forget: (id) => dropChat('channel', id),
    fallbackError: 'Unable to load channel',
  });

  const value = useMemo<ActiveChannelValue>(
    () => ({ channel: item, targetId, loading, error, load, reload, clear }),
    [item, targetId, loading, error, load, reload, clear],
  );

  return <ActiveChannelContext.Provider value={value}>{children}</ActiveChannelContext.Provider>;
};
