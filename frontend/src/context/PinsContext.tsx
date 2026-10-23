'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveChannel } from '@/hooks/useActiveChannel';
import { useSocket } from '@/hooks/useSocket';
import { listChannelPins, pinMessage, unpinMessage } from '@/lib/pins';
import { fetchShared, peek } from '@/lib/cache';
import type { Message } from '@/types/message';
import type { PinnedMessage } from '@/types/saved';

type PinsValue = {
  channelId: string | null;
  pins: PinnedMessage[];
  pinnedIds: Set<string>;
  loading: boolean;
  pin: (messageId: string) => Promise<void>;
  unpin: (messageId: string) => Promise<void>;
  togglePin: (messageId: string) => Promise<void>;
  applyMessage: (message: Message) => void;
  removeMessage: (messageId: string) => void;
  reload: () => Promise<void>;
};

export const PinsContext = createContext<PinsValue | null>(null);

export const PinsProvider = ({ children }: { children: React.ReactNode }) => {
  const { channel } = useActiveChannel();
  const { socket } = useSocket();
  const channelId = channel?.id ?? null;
  const [pins, setPins] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const pinnedIds = useMemo(() => new Set(pins.map((pin) => pin.messageId)), [pins]);

  // Cached per channel: shown at once, refreshed in the background.
  const load = useCallback(async (id: string) => {
    const key = `pins:channel:${id}`;
    const cached = peek<PinnedMessage[]>(key);
    setPins(cached ?? []);
    setLoading(!cached);
    try {
      const list = await fetchShared(key, () => listChannelPins(id).then((result) => result.pins));
      setPins(list);
    } catch {
      setPins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!channelId) {
      setPins([]);
      return;
    }
    void load(channelId);
  }, [channelId, load]);

  useEffect(() => {
    if (!socket || !channelId) {
      return;
    }
    const onPin = (payload: { channelId: string }) => {
      if (String(payload.channelId) === String(channelId)) {
        void load(channelId);
      }
    };
    const onDeleted = (payload: { message?: { channelId?: string | null } }) => {
      if (payload?.message && String(payload.message.channelId) === String(channelId)) {
        void load(channelId);
      }
    };
    socket.on('pin.updated', onPin);
    socket.on('message.deleted', onDeleted);
    return () => {
      socket.off('pin.updated', onPin);
      socket.off('message.deleted', onDeleted);
    };
  }, [socket, channelId, load]);

  const pin = useCallback(
    async (messageId: string) => {
      if (!channelId) {
        return;
      }
      const result = await pinMessage(channelId, messageId);
      if (result.pin) {
        setPins((current) =>
          current.some((item) => item.id === result.pin?.id)
            ? current
            : [result.pin as PinnedMessage, ...current],
        );
      }
    },
    [channelId],
  );

  const unpin = useCallback(
    async (messageId: string) => {
      if (!channelId) {
        return;
      }
      await unpinMessage(channelId, messageId);
      setPins((current) => current.filter((item) => item.messageId !== messageId));
    },
    [channelId],
  );

  const togglePin = useCallback(
    async (messageId: string) => {
      if (pinnedIds.has(messageId)) {
        await unpin(messageId);
      } else {
        await pin(messageId);
      }
    },
    [pinnedIds, pin, unpin],
  );

  // Keep a pinned message's reactions/edits in sync after an action.
  const applyMessage = useCallback((message: Message) => {
    setPins((current) =>
      current.map((item) => (item.message.id === message.id ? { ...item, message } : item)),
    );
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setPins((current) => current.filter((item) => item.messageId !== messageId));
  }, []);

  const reload = useCallback(
    () => (channelId ? load(channelId) : Promise.resolve()),
    [channelId, load],
  );

  const value = useMemo<PinsValue>(
    () => ({
      channelId,
      pins,
      pinnedIds,
      loading,
      pin,
      unpin,
      togglePin,
      applyMessage,
      removeMessage,
      reload,
    }),
    [
      channelId,
      pins,
      pinnedIds,
      loading,
      pin,
      unpin,
      togglePin,
      applyMessage,
      removeMessage,
      reload,
    ],
  );

  return <PinsContext.Provider value={value}>{children}</PinsContext.Provider>;
};
