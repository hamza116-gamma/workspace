'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSocket } from './useSocket';
import { listChannelAttachments, listConversationAttachments } from '@/lib/attachments';
import { fetchShared, peek } from '@/lib/cache';
import type { MessageAttachment } from '@/types/message';

export type AttachmentTarget = { kind: 'channel' | 'conversation'; id: string } | null;

type MessagePayload = {
  message?: {
    channelId?: string | null;
    conversationId?: string | null;
    attachments?: unknown[];
    deletedAt?: string | null;
  };
};

export const useAttachments = (target: AttachmentTarget) => {
  const { socket } = useSocket();
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [loading, setLoading] = useState(false);

  const kind = target?.kind ?? null;
  const id = target?.id ?? null;

  const load = useCallback(async () => {
    if (!kind || !id) {
      setAttachments([]);
      return;
    }
    // Cached per chat: shown at once, refreshed in the background.
    const key = `files:${kind}:${id}`;
    const cached = peek<MessageAttachment[]>(key);
    setAttachments(cached ?? []);
    setLoading(!cached);
    try {
      const list = await fetchShared(key, () =>
        (kind === 'channel' ? listChannelAttachments(id) : listConversationAttachments(id)).then(
          (result) => result.attachments,
        ),
      );
      setAttachments(list);
    } catch {
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, [kind, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh the media browser live when a message with attachments is added or
  // removed in the open channel / conversation.
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
      const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0;
      if (matches && (hasAttachments || message.deletedAt)) {
        void load();
      }
    };

    socket.on('message.created', onMessage);
    socket.on('message.deleted', onMessage);
    return () => {
      socket.off('message.created', onMessage);
      socket.off('message.deleted', onMessage);
    };
  }, [socket, kind, id, load]);

  return { attachments, loading };
};
