'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import { useFocusMessage } from '@/hooks/useFocusMessage';
import { useChannels } from '@/hooks/useChannels';
import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { formatFullTimestamp } from '@/lib/format';
import type { NotificationItem } from '@/types/notification';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { tokensToDisplay } from '@/lib/mentions';
import { MentionText } from '@/components/tasks/MentionText';
import styles from './ActivityDropdown.module.css';

// Slack-style hover card for the sidebar "Activity" item: recent activity
// with a per-item mark-as-read action on hover.
export const ActivityDropdown = ({ onNavigate }: { onNavigate?: () => void }) => {
  const router = useRouter();
  const { items, loading, markRead, markAllRead } = useNotifications();
  const memberUsers = useOrgMembers().map((member) => member.user);
  const { focusMessage } = useFocusMessage();
  const { channels } = useChannels();
  const { conversations } = useConversations();
  const { user } = useAuth();

  const channelName = (id: string | null) =>
    id ? `#${channels.find((channel) => channel.id === id)?.name ?? 'channel'}` : '';

  const conversationTitle = (id: string | null) => {
    if (!id) {
      return 'a conversation';
    }
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) {
      return 'a conversation';
    }
    const others = conversation.participants
      .filter((participant) => participant.user.id !== user?.id)
      .map((participant) => participant.user.fullName);
    return others.join(', ') || 'a conversation';
  };

  const describe = (notification: NotificationItem) => {
    switch (notification.type) {
      case 'MENTION':
        return notification.channelId
          ? `mentioned you in ${channelName(notification.channelId)}`
          : 'mentioned you';
      case 'DM':
        return 'sent you a direct message';
      case 'TASK_ASSIGNED':
        return notification.channelId
          ? `assigned you a task in ${channelName(notification.channelId)}`
          : 'assigned you a task';
      case 'TASK_DUE':
        return 'Your task is due within 24 hours';
      case 'THREAD_REPLY':
        return notification.channelId
          ? `replied in a thread in ${channelName(notification.channelId)}`
          : 'replied in a thread';
      default:
        return notification.channelId
          ? `posted in ${channelName(notification.channelId)}`
          : 'posted a message';
    }
  };

  const location = (notification: NotificationItem) =>
    notification.channelId
      ? `/channels/${notification.channelId}?message=${notification.messageId}`
      : `/dm/${notification.conversationId}?message=${notification.messageId}`;

  const recent = items.slice(0, 8);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <span className={styles.title}>Activity</span>
        {items.length > 0 && (
          <button type="button" className={styles.markAll} onClick={() => void markAllRead()}>
            Mark all as read
          </button>
        )}
      </header>

      {loading && items.length === 0 && (
        <div className={styles.center}>
          <Spinner />
        </div>
      )}

      {!loading && items.length === 0 && <p className={styles.empty}>No activity yet.</p>}

      {recent.length > 0 && (
        <ul className={styles.list}>
          {recent.map((notification) => {
            const unread = !notification.readAt;
            return (
              <li key={notification.id} className={`${styles.item} ${unread ? styles.unread : ''}`}>
                <Link
                  href={location(notification)}
                  className={styles.open}
                  onClick={() => {
                    if (unread) {
                      void markRead(notification.id);
                    }
                    focusMessage(notification.messageId);
                    onNavigate?.();
                  }}
                >
                  <Avatar
                    name={notification.actor.fullName}
                    src={notification.actor.avatarUrl}
                    size={28}
                  />
                  <span className={styles.body}>
                    <span className={styles.line1}>
                      <span className={styles.actor}>{notification.actor.fullName}</span>
                      <span className={styles.action}>{describe(notification)}</span>
                    </span>
                    {notification.snippet && (
                      <span className={styles.snippet}>
                        <MentionText
                          text={tokensToDisplay(notification.snippet, memberUsers)}
                          names={memberUsers.map((user) => user.fullName)}
                        />
                      </span>
                    )}
                    <span className={styles.meta}>
                      {formatFullTimestamp(notification.createdAt)}
                    </span>
                  </span>
                  {unread && <span className={styles.dot} aria-hidden />}
                </Link>
                {unread && (
                  <button
                    type="button"
                    className={styles.readButton}
                    aria-label="Mark as read"
                    title="Mark as read"
                    onClick={() => void markRead(notification.id)}
                  >
                    <Icon name="checkCircle" size={17} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 8 && (
        <Link href="/activity" className={styles.viewAll} onClick={() => onNavigate?.()}>
          View all activity
        </Link>
      )}
    </div>
  );
};
