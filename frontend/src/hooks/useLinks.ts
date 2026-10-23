'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSocket } from './useSocket';
import { listChannelLinks, listConversationLinks } from '@/lib/links';
import { fetchShared, peek } from '@/lib/cache';
import type { MessageLink } from '@/types/link';

export type LinkTarget = { kind: 'channel' | 'conversation'; id: string } | null;

type MessagePayload = {
  message?: {
    channelId?: string | null;
    conversationId?: string | null;
    content?: string;
    deletedAt?: string | null;
  };
};

export const useLinks = (target: LinkTarget) => {
  const { socket } = useSocket();
  const [links, setLinks] = useState<MessageLink[]>([]);
  const [loading, setLoading] = useState(false);

  const kind = target?.kind ?? null;
  const id = target?.id ?? null;

  const load = useCallback(async () => {
    if (!kind || !id) {
      setLinks([]);
      return;
    }
    // Cached per chat: shown at once, refreshed in the background.
    const key = `links:${kind}:${id}`;
    const cached = peek<MessageLink[]>(key);
    setLinks(cached ?? []);
    setLoading(!cached);
    try {
      const list = await fetchShared(key, () =>
        (kind === 'channel' ? listChannelLinks(id) : listConversationLinks(id)).then(
          (result) => result.links,
        ),
      );
      setLinks(list);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [kind, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Links change when a message with a URL is created, edited or deleted.
  useEffect(() => {
    if (!socket || !kind || !id) {
      return;
    }
    const onMessage = (payload: MessagePayload) => {
      const message = payload?.message;
      if (!message) {
        return;
      }
      const matches =
        kind === 'channel'
          ? String(message.channelId) === String(id)
          : String(message.conversationId) === String(id);
      if (matches) {
        void load();
      }
    };

    socket.on('message.created', onMessage);
    socket.on('message.updated', onMessage);
    socket.on('message.deleted', onMessage);
    return () => {
      socket.off('message.created', onMessage);
      socket.off('message.updated', onMessage);
      socket.off('message.deleted', onMessage);
    };
  }, [socket, kind, id, load]);

  return { links, loading };
};
