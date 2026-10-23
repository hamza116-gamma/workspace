'use client';

import Link from 'next/link';
import { prefetchChat } from '@/lib/chatCache';
import { Icon } from '@/components/ui/Icon';
import { HuddlePill } from '@/components/huddle/HuddlePill';
import { useDrafts } from '@/hooks/useDrafts';
import { useUnread } from '@/hooks/useUnread';
import type { Channel } from '@/types/channel';
import styles from './ChannelListItem.module.css';

export const ChannelListItem = ({ channel, active }: { channel: Channel; active: boolean }) => {
  const { channels } = useUnread();
  const counts = channels[channel.id] ?? { unread: 0, mentions: 0 };
  const muted = channel.membership?.notifyPreference === 'MUTE';
  const unread = (!muted && counts.unread > 0) || counts.mentions > 0;
  const hasDraft = useDrafts().hasPendingDraft(`channel:${channel.id}`);

  return (
    <Link
      href={`/channels/${channel.id}`}
      // Hover / keyboard focus warms the chat cache (instant first open).
      onMouseEnter={() => void prefetchChat('channel', channel.id)}
      onFocus={() => void prefetchChat('channel', channel.id)}
      className={`${styles.item} ${active ? styles.active : ''} ${unread ? styles.unread : ''} ${muted ? styles.muted : ''}`}
    >
      {channel.type === 'PRIVATE' ? <Icon name="lock" size={14} /> : <Icon name="hash" size={14} />}
      <span className={styles.name}>{channel.name}</span>
      <HuddlePill target={{ kind: 'channel', id: channel.id }} />
      {channel.status === 'ARCHIVED' && <span className={styles.archived}>archived</span>}
      {hasDraft && (
        <span className={styles.draftIcon} title="Draft" aria-label="Has a draft">
          <Icon name="pencil" size={13} />
        </span>
      )}
      {muted && !hasDraft && counts.mentions === 0 && (
        <span className={styles.mutedIcon} title="Muted" aria-label="Muted">
          <Icon name="bell-off" size={13} />
        </span>
      )}
      {counts.mentions > 0 && (
        <span className={styles.badge} aria-label={`${counts.mentions} mentions`}>
          {counts.mentions}
        </span>
      )}
    </Link>
  );
};
