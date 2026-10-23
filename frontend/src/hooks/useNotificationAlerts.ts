'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useChannels } from '@/hooks/useChannels';
import { useActiveChannel } from '@/hooks/useActiveChannel';
import { useActiveConversation } from '@/hooks/useActiveConversation';
import { useFocusMessage } from '@/hooks/useFocusMessage';
import { isDndActive } from '@/lib/dnd';
import { playKnock, readNotifyPrefs, showDesktopNotification } from '@/lib/desktopNotify';
import type { NotificationItem } from '@/types/notification';

const locationOf = (notification: NotificationItem) =>
  notification.channelId
    ? `/channels/${notification.channelId}?message=${notification.messageId}`
    : `/dm/${notification.conversationId}?message=${notification.messageId}`;

/**
 * Returns `alert(notification, silent)`: plays the sound and (when the tab is
 * hidden) shows a desktop popup, unless the event is silent, DND is active,
 * or the user is looking at that chat in a visible tab.
 */
export const useNotificationAlerts = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { channels } = useChannels();
  const { channel } = useActiveChannel();
  const { conversation } = useActiveConversation();
  const { focusMessage } = useFocusMessage();

  const state = useRef({ user, channels, channelId: channel?.id, conversationId: conversation?.id });
  useEffect(() => {
    state.current = { user, channels, channelId: channel?.id, conversationId: conversation?.id };
  }, [user, channels, channel?.id, conversation?.id]);

  return useCallback(
    (notification: NotificationItem, silent: boolean) => {
      const current = state.current;
      if (silent || isDndActive(current.user)) {
        return;
      }
      const visible = document.visibilityState === 'visible';
      const viewing =
        (notification.channelId && notification.channelId === current.channelId) ||
        (notification.conversationId && notification.conversationId === current.conversationId);
      if (visible && viewing) {
        return;
      }
      const prefs = readNotifyPrefs();
      if (prefs.sound) {
        playKnock();
      }
      if (!prefs.desktop || visible) {
        return;
      }
      const channelName = current.channels.find((item) => item.id === notification.channelId)?.name;
      showDesktopNotification({
        title: channelName
          ? `${notification.actor.fullName} in #${channelName}`
          : notification.actor.fullName,
        body: notification.snippet || 'New message',
        tag: notification.id,
        icon: notification.actor.avatarUrl,
        onClick: () => {
          router.push(locationOf(notification));
          focusMessage(notification.messageId);
        },
      });
    },
    [router, focusMessage],
  );
};
