'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { getInitials } from '@/lib/initials';
import { shortWhen } from '@/lib/relativeDays';
import type { NotificationItem } from '@/types/notification';
import { MentionText } from '@/components/tasks/MentionText';
import styles from './Activity.module.css';

type Props = {
  item: NotificationItem;
  href: string;
  action: React.ReactNode;
  where: string;
  onOpen: () => void;
  onRemove: () => void;
  // Workspace member names: their @mentions in the snippet are highlighted.
  mentionNames?: string[];
};

const FeedIcon = ({ item }: { item: NotificationItem }) => {
  switch (item.type) {
    case 'MENTION':
      return <span className={`${styles.feedIc} ${styles.warn}`}>@</span>;
    case 'THREAD_REPLY':
      return (
        <span className={`${styles.feedIc} ${styles.info}`}>
          <Icon name="message" size={15} />
        </span>
      );
    case 'TASK_ASSIGNED':
    case 'TASK_DUE':
      return (
        <span className={`${styles.feedIc} ${styles.info}`}>
          <Icon name="task" size={15} />
        </span>
      );
    case 'DM':
      return (
        <span className={`${styles.feedIc} ${styles.brand}`}>
          {getInitials(item.actor.fullName)}
        </span>
      );
    default:
      return (
        <span className={styles.feedIc}>
          {(item.type as string) === 'REACTION' ? '🙌' : <Icon name="hash" size={15} />}
        </span>
      );
  }
};

// One row of the Recent feed (design: .feed-item).
export const ActivityFeedItem = ({
  item,
  href,
  action,
  where,
  onOpen,
  onRemove,
  mentionNames = [],
}: Props) => {
  const unread = !item.readAt;
  return (
    <div className={`${styles.feedItem} ${unread ? styles.unread : ''}`}>
      <Link href={href} className={styles.feedLink} onClick={onOpen}>
        <FeedIcon item={item} />
        <div className={styles.feedBody}>
          <p>
            <b>{item.actor.fullName}</b> {action}
          </p>
          {item.snippet && (
            <div className={styles.quote}>
              <MentionText text={item.snippet} names={mentionNames} />
            </div>
          )}
          <p className={styles.hintTime}>
            {shortWhen(item.createdAt)}
            {where && ` · ${where}`}
          </p>
        </div>
        {unread && <span className={styles.dotUnread} aria-hidden />}
      </Link>
      <button
        type="button"
        className={styles.remove}
        onClick={onRemove}
        aria-label="Clear notification"
        title="Clear"
      >
        <Icon name="close" size={13} />
      </button>
    </div>
  );
};
