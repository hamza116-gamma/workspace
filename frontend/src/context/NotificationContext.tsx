'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { useSocket } from '@/hooks/useSocket';
import { useActiveChannel } from '@/hooks/useActiveChannel';
import { useActiveConversation } from '@/hooks/useActiveConversation';
import { useNotificationAlerts } from '@/hooks/useNotificationAlerts';
import { useDndSync } from '@/hooks/useDndSync';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
} from '@/lib/notifications';
import type { NotificationItem } from '@/types/notification';

type NotificationValue = {
  items: NotificationItem[];
  unreadCount: number;
  mentionCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  reload: () => Promise<void>;
};

export const NotificationContext = createContext<NotificationValue | null>(null);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { active } = useOrg();
  const { socket } = useSocket();
  const { channel: activeChannel } = useActiveChannel();
  const { conversation: activeConversation } = useActiveConversation();
  const organizationId = active?.id;
  const alert = useNotificationAlerts();
  useDndSync();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // The unread badge is derived from the items, so a duplicated live event
  // can never double-count (new items are deduped by id).
  const unreadCount = useMemo(
    () => items.filter((item) => !item.readAt).length,
    [items],
  );

  // Slack's Activity badge counts only MENTIONS (DMs badge on the DM item
  // itself in the sidebar).
  const mentionCount = useMemo(
    () => items.filter((item) => !item.readAt && item.type === 'MENTION').length,
    [items],
  );

  const reload = useCallback(async () => {
    if (!organizationId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await listNotifications();
      setItems(result.notifications);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Opening a channel/DM marks its notifications read on the server
  // (unread read endpoints), so refresh to drop that chat's badge counts -
  // Slack clears mentions for the chat you are viewing.
  useEffect(() => {
    if (activeChannel || activeConversation) {
      void reload();
    }
  }, [activeChannel?.id, activeConversation?.id, reload]);

  // Live updates: new notifications arrive on the user's room. Adding is
  // idempotent (deduped by id); read state is only ever set, never cleared.
  useEffect(() => {
    if (!socket || !organizationId) {
      return;
    }
    const onCreated = (payload: {
      organizationId?: string;
      silent?: boolean;
      notification?: NotificationItem;
    }) => {
      const notification = payload?.notification;
      // Other workspaces' notifications are ignored.
      if (!notification || (payload.organizationId && payload.organizationId !== organizationId)) {
        return;
      }
      setItems((current) =>
        current.some((item) => item.id === notification.id)
          ? current
          : [notification, ...current],
      );
      // Sound / desktop popup (skipped for silent DND deliveries).
      alert(notification, Boolean(payload.silent));
    };
    const onRead = (payload: { id?: string }) => {
      if (!payload?.id) {
        return;
      }
      setItems((current) =>
        current.map((item) =>
          item.id === payload.id && !item.readAt
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
    };
    const onReadAll = () => {
      setItems((current) =>
        current.map((item) =>
          item.readAt ? item : { ...item, readAt: new Date().toISOString() },
        ),
      );
    };

    socket.on('notification.created', onCreated);
    socket.on('notification.read', onRead);
    socket.on('notification.read_all', onReadAll);
    return () => {
      socket.off('notification.created', onCreated);
      socket.off('notification.read', onRead);
      socket.off('notification.read_all', onReadAll);
    };
  }, [socket, organizationId, alert]);

  const markRead = useCallback(async (id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id && !item.readAt
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    );
    try {
      await markNotificationRead(id);
    } catch {
      // optimistic update stays; next reload corrects it
    }
  }, []);

  const markAll = useCallback(async () => {
    setItems((current) =>
      current.map((item) =>
        item.readAt ? item : { ...item, readAt: new Date().toISOString() },
      ),
    );
    try {
      await markAllNotificationsRead();
    } catch {
      // optimistic update stays; next reload corrects it
    }
  }, []);

  const remove = useCallback(
    async (id: string) => {
      setItems((current) => current.filter((item) => item.id !== id));
      try {
        await removeNotification(id);
      } catch {
        // optimistic update stays; next reload corrects it
      }
    },
    [],
  );

  const value = useMemo<NotificationValue>(
    () => ({
      items,
      unreadCount,
      mentionCount,
      loading,
      markRead,
      markAllRead: markAll,
      remove,
      reload,
    }),
    [items, unreadCount, mentionCount, loading, markRead, markAll, remove, reload],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};
