'use client';

import Link from 'next/link';
import { prefetchChat } from '@/lib/chatCache';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { HuddlePill } from '@/components/huddle/HuddlePill';
import { useDrafts } from '@/hooks/useDrafts';
import { useUnread } from '@/hooks/useUnread';
import type { Conversation } from '@/types/conversation';
import type { PresenceState } from '@/types/user';
import styles from './DirectMessageListItem.module.css';

export const DirectMessageListItem = ({
  conversation,
  currentUserId,
  presence,
  active,
}: {
  conversation: Conversation;
  currentUserId?: string;
  presence: Record<string, PresenceState>;
  active: boolean;
}) => {
  const others = conversation.participants
    .filter((participant) => participant.user.id !== currentUserId)
    .map((participant) => participant.user);

  const title =
    conversation.type === 'GROUP'
      ? others.map((other) => other.fullName).join(', ')
      : (others[0]?.fullName ?? 'Direct message');

  const single = others.length === 1 ? others[0] : null;

  const { conversations } = useUnread();
  const muted = Boolean(conversation.muted);
  const unread = muted ? 0 : (conversations[conversation.id] ?? 0);
  const hasDraft = useDrafts().hasPendingDraft(`conversation:${conversation.id}`);

  return (
    <Link
      href={`/dm/${conversation.id}`}
      // Hover / keyboard focus warms the chat cache (instant first open).
      onMouseEnter={() => void prefetchChat('conversation', conversation.id)}
      onFocus={() => void prefetchChat('conversation', conversation.id)}
      className={`${styles.item} ${active ? styles.active : ''} ${unread > 0 ? styles.unread : ''} ${muted ? styles.muted : ''}`}
    >
      {single ? (
        <Avatar
          name={single.fullName}
          src={single.avatarUrl}
          size={22}
          presence={presence[single.id] ?? single.presence}
        />
      ) : (
        <span className={styles.stack}>
          {others.slice(0, 2).map((other) => (
            <Avatar key={other.id} name={other.fullName} src={other.avatarUrl} size={16} />
          ))}
        </span>
      )}
      <span className={styles.name}>{title}</span>
      <HuddlePill target={{ kind: 'conversation', id: conversation.id }} />
      {hasDraft && (
        <span className={styles.draftIcon} title="Draft" aria-label="Has a draft">
          <Icon name="pencil" size={13} />
        </span>
      )}
      {muted && !hasDraft && (
        <span className={styles.mutedIcon} title="Muted" aria-label="Muted">
          <Icon name="bell-off" size={13} />
        </span>
      )}
      {unread > 0 && (
        <span className={styles.badge} aria-label={`${unread} unread messages`}>
          {unread}
        </span>
      )}
    </Link>
  );
};
