'use client';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { Channel } from '@/types/channel';
import styles from './ChannelBrowser.module.css';

export const ChannelBrowserRow = ({
  channel,
  busy,
  canUnarchive,
  onOpen,
  onJoin,
  onUnarchive,
}: {
  channel: Channel;
  busy: boolean;
  canUnarchive: boolean;
  onOpen: () => void;
  onJoin: () => void;
  onUnarchive: () => void;
}) => {
  const archived = channel.status === 'ARCHIVED';
  const description = channel.purpose || channel.topic;

  return (
    <div className={styles.row}>
      <button type="button" className={styles.main} onClick={onOpen}>
        <span className={styles.icon}>
          <Icon name={channel.type === 'PRIVATE' ? 'lock' : 'hash'} size={15} />
        </span>
        <span className={styles.info}>
          <span className={styles.name}>
            {channel.name}
            {channel.isDefault && <span className={styles.pill}>Default</span>}
            {channel.isMember && !archived && (
              <span className={`${styles.pill} ${styles.pillOk}`}>Joined</span>
            )}
            {archived && <span className={`${styles.pill} ${styles.pillWarn}`}>Archived</span>}
          </span>
          <span className={styles.meta}>
            {channel.memberCount} {channel.memberCount === 1 ? 'member' : 'members'}
            {description && ` · ${description}`}
          </span>
        </span>
      </button>
      {archived && canUnarchive && (
        <Button variant="secondary" loading={busy} onClick={onUnarchive}>
          Unarchive
        </Button>
      )}
      {!archived && !channel.isMember && channel.type === 'PUBLIC' && (
        <Button variant="secondary" loading={busy} onClick={onJoin}>
          Join
        </Button>
      )}
    </div>
  );
};
