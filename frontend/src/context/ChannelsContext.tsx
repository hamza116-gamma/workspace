'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { useSocket } from '@/hooks/useSocket';
import { listChannels } from '@/lib/channels';
import type { Channel } from '@/types/channel';

type ChannelsValue = {
  channels: Channel[];
  loading: boolean;
  error: string;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  /** Optimistic local update (e.g. star / notify preference). */
  patchChannel: (channelId: string, patch: (channel: Channel) => Channel) => void;
};

export const ChannelsContext = createContext<ChannelsValue | null>(null);

export const ChannelsProvider = ({ children }: { children: React.ReactNode }) => {
  const { active } = useOrg();
  const { socket } = useSocket();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const organizationId = active?.id;

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!organizationId) {
        setChannels([]);
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const result = await listChannels();
        setChannels(result.channels);
        setError('');
      } catch (err) {
        if (!silent) {
          setChannels([]);
          setError(err instanceof Error ? err.message : 'Unable to load channels');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [organizationId],
  );

  const patchChannel = useCallback(
    (channelId: string, patch: (channel: Channel) => Channel) =>
      setChannels((current) =>
        current.map((channel) => (channel.id === channelId ? patch(channel) : channel)),
      ),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket) {
      return;
    }
    const onUpdated = (payload?: { organizationId?: string }) => {
      if (payload?.organizationId && payload.organizationId !== organizationId) {
        return;
      }
      void refresh({ silent: true });
    };
    socket.on('channel.membership.updated', onUpdated);
    socket.on('channel.updated', onUpdated);
    return () => {
      socket.off('channel.membership.updated', onUpdated);
      socket.off('channel.updated', onUpdated);
    };
  }, [socket, refresh, organizationId]);

  const value = useMemo<ChannelsValue>(
    () => ({ channels, loading, error, refresh, patchChannel }),
    [channels, loading, error, refresh, patchChannel],
  );

  return <ChannelsContext.Provider value={value}>{children}</ChannelsContext.Provider>;
};
