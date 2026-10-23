'use client';

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { useSocket } from '@/hooks/useSocket';
import { useActiveChannel } from '@/hooks/useActiveChannel';
import { useActiveConversation } from '@/hooks/useActiveConversation';
import { useMutedTargets } from '@/hooks/useMutedTargets';
import {
  getUnreadSummary,
  markChannelRead as markChannelReadApi,
  markConversationRead as markConversationReadApi,
} from '@/lib/unread';

type ChannelUnread = { unread: number; mentions: number };

type UnreadValue = {
  // Server-backed unread state
  channels: Record<string, ChannelUnread>;
  conversations: Record<string, number>;
  totals: { unread: number; mentions: number };
  markChannelRead: (channelId: string) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
  reload: () => Promise<void>;
  // Session-local "mark as unread" divider (explicit user action)
  marks: Record<string, string>;
  mark: (targetKey: string, messageId: string) => void;
  clear: (targetKey: string) => void;
};

export const UnreadContext = createContext<UnreadValue | null>(null);

export const UnreadProvider = ({ children }: { children: React.ReactNode }) => {
  const { active } = useOrg();
  const { socket } = useSocket();
  const { channel: activeChannel } = useActiveChannel();
  const { conversation: activeConversation } = useActiveConversation();
  const muted = useMutedTargets();

  const organizationId = active?.id;
  const activeChannelId = activeChannel?.id ?? null;
  const activeConversationId = activeConversation?.id ?? null;

  const [channels, setChannels] = useState<Record<string, ChannelUnread>>({});
  const [conversations, setConversations] = useState<Record<string, number>>({});
  const [marks, setMarks] = useState<Record<string, string>>({});

  // The open chat is read through a ref so switching chats does not
  // re-fetch the summary.
  const openRef = useRef({ channelId: activeChannelId, conversationId: activeConversationId });
  useEffect(() => {
    openRef.current = { channelId: activeChannelId, conversationId: activeConversationId };
  }, [activeChannelId, activeConversationId]);

  // Server truth wins; the conversation/channel the user currently has open
  // stays clear (viewing = read, matching Slack).
  const applySummary = useCallback(
    (summary: {
      channels: { channelId: string; unread: number; mentions: number }[];
      conversations: { conversationId: string; unread: number }[];
    }) => {
      const nextChannels: Record<string, ChannelUnread> = {};
      summary.channels.forEach((item) => {
        nextChannels[item.channelId] = { unread: item.unread, mentions: item.mentions };
      });
      const nextConversations: Record<string, number> = {};
      summary.conversations.forEach((item) => {
        nextConversations[item.conversationId] = item.unread;
      });
      const open = openRef.current;
      if (open.channelId) {
        nextChannels[open.channelId] = { unread: 0, mentions: 0 };
      }
      if (open.conversationId) {
        nextConversations[open.conversationId] = 0;
      }
      setChannels(nextChannels);
      setConversations(nextConversations);
    },
    [],
  );

  const reload = useCallback(async () => {
    if (!organizationId) {
      setChannels({});
      setConversations({});
      return;
    }
    try {
      applySummary(await getUnreadSummary());
    } catch {
      // keep the previous state on failure
    }
  }, [organizationId, applySummary]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Live updates re-read the server summary (debounced) instead of counting
  // locally, so a duplicated event can never inflate a badge.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) {
      clearTimeout(reloadTimer.current);
    }
    reloadTimer.current = setTimeout(() => void reload(), 400);
  }, [reload]);

  // A chat that is open in a VISIBLE tab is read: tell the server (debounced)
  // so badges do not come back after leaving it.
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markOpenChatRead = useCallback(() => {
    if (readTimer.current) {
      clearTimeout(readTimer.current);
    }
    readTimer.current = setTimeout(() => {
      if (activeChannelId) {
        void markChannelReadApi(activeChannelId).catch(() => undefined);
      } else if (activeConversationId) {
        void markConversationReadApi(activeConversationId).catch(() => undefined);
      }
    }, 800);
  }, [activeChannelId, activeConversationId]);

  useEffect(() => {
    if (!socket) {
      return;
    }
    const onUnread = (payload: {
      organizationId?: string;
      channelId: string | null;
      conversationId: string | null;
    }) => {
      // Other workspaces' events are ignored.
      if (payload.organizationId && payload.organizationId !== organizationId) {
        return;
      }
      const isOpen =
        (payload.channelId && payload.channelId === activeChannelId) ||
        (payload.conversationId && payload.conversationId === activeConversationId);
      if (isOpen && document.visibilityState === 'visible') {
        markOpenChatRead();
        return;
      }
      scheduleReload();
    };
    socket.on('unread.updated', onUnread);
    return () => {
      socket.off('unread.updated', onUnread);
      if (reloadTimer.current) {
        clearTimeout(reloadTimer.current);
      }
    };
  }, [
    socket,
    scheduleReload,
    organizationId,
    activeChannelId,
    activeConversationId,
    markOpenChatRead,
  ]);

  // Becoming visible again marks the open chat read.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (activeChannelId) {
        setChannels((current) => ({ ...current, [activeChannelId]: { unread: 0, mentions: 0 } }));
      } else if (activeConversationId) {
        setConversations((current) => ({ ...current, [activeConversationId]: 0 }));
      }
      markOpenChatRead();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (readTimer.current) {
        clearTimeout(readTimer.current);
      }
    };
  }, [activeChannelId, activeConversationId, markOpenChatRead]);

  const markChannelRead = useCallback(async (channelId: string) => {
    setChannels((current) => ({ ...current, [channelId]: { unread: 0, mentions: 0 } }));
    try {
      await markChannelReadApi(channelId);
    } catch {
      // optimistic update stays; next reload corrects it
    }
  }, []);

  const markConversationRead = useCallback(async (conversationId: string) => {
    setConversations((current) => ({ ...current, [conversationId]: 0 }));
    try {
      await markConversationReadApi(conversationId);
    } catch {
      // optimistic update stays; next reload corrects it
    }
  }, []);

  const totals = useMemo(() => {
    let unread = 0;
    let mentions = 0;
    // Muted chats add no unread badge; mentions still count.
    Object.entries(channels).forEach(([id, item]) => {
      if (!muted.channelIds.has(id)) unread += item.unread;
      mentions += item.mentions;
    });
    Object.entries(conversations).forEach(([id, count]) => {
      if (!muted.conversationIds.has(id)) unread += count;
    });
    return { unread, mentions };
  }, [channels, conversations, muted]);

  const mark = useCallback((targetKey: string, messageId: string) => {
    setMarks((current) => ({ ...current, [targetKey]: messageId }));
  }, []);

  const clear = useCallback((targetKey: string) => {
    setMarks((current) => {
      if (!(targetKey in current)) {
        return current;
      }
      const next = { ...current };
      delete next[targetKey];
      return next;
    });
  }, []);

  const value = useMemo<UnreadValue>(
    () => ({
      channels,
      conversations,
      totals,
      markChannelRead,
      markConversationRead,
      reload,
      marks,
      mark,
      clear,
    }),
    [
      channels,
      conversations,
      totals,
      markChannelRead,
      markConversationRead,
      reload,
      marks,
      mark,
      clear,
    ],
  );

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
};
