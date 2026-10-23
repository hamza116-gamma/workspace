'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { useSocket } from '@/hooks/useSocket';
import { listConversations } from '@/lib/conversations';
import type { Conversation } from '@/types/conversation';

type ConversationsValue = {
  conversations: Conversation[];
  loading: boolean;
  error: string;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  /** Optimistic local update (e.g. mute). */
  patchConversation: (
    conversationId: string,
    patch: (conversation: Conversation) => Conversation,
  ) => void;
};

export const ConversationsContext = createContext<ConversationsValue | null>(null);

export const ConversationsProvider = ({ children }: { children: React.ReactNode }) => {
  const { active } = useOrg();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const organizationId = active?.id;

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!organizationId) {
        setConversations([]);
        setLoading(false);
        return;
      }
      if (!silent) {
        setLoading(true);
      }
      try {
        const result = await listConversations();
        setConversations(result.conversations);
        setError('');
      } catch (err) {
        if (!silent) {
          setConversations([]);
          setError(err instanceof Error ? err.message : 'Unable to load messages');
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [organizationId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patchConversation = useCallback(
    (conversationId: string, patch: (conversation: Conversation) => Conversation) =>
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId ? patch(conversation) : conversation,
        ),
      ),
    [],
  );

  const socketId = socket?.id;
  useEffect(() => {
    if (!socket) {
      return;
    }
    // A message in a DM just bumps last activity + moves it to the top; we
    // update locally instead of refetching (which flashed the sidebar list).
    const onUpdated = (payload: { conversationId?: string; lastActivityAt?: string }) => {
      const id = payload?.conversationId;
      if (!id) {
        return;
      }
      setConversations((current) => {
        const index = current.findIndex((conversation) => conversation.id === id);
        if (index === -1) {
          void refresh({ silent: true });
          return current;
        }
        const updated = {
          ...current[index],
          lastActivityAt: payload.lastActivityAt ?? current[index].lastActivityAt,
        };
        return [updated, ...current.filter((conversation) => conversation.id !== id)];
      });
    };
    const onCreated = () => {
      void refresh({ silent: true });
    };

    socket.on('conversation.updated', onUpdated);
    socket.on('conversation.created', onCreated);
    return () => {
      socket.off('conversation.updated', onUpdated);
      socket.off('conversation.created', onCreated);
    };
  }, [socket, socketId, refresh]);

  const value = useMemo<ConversationsValue>(
    () => ({ conversations, loading, error, refresh, patchConversation }),
    [conversations, loading, error, refresh, patchConversation],
  );

  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
};
