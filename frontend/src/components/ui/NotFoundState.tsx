'use client';

import { useRouter } from 'next/navigation';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import styles from './NotFoundState.module.css';

/**
 * Centred "not found / can't load" screen used everywhere in the app
 * (channel, DM, project, thread, unknown page): icon, title, explanation
 * and one way out.
 */
export const NotFoundState = ({
  icon = 'search',
  title,
  text,
  actionLabel = 'Go to #general',
  actionHref = '/',
  compact = false,
}: {
  icon?: IconName;
  title: string;
  text: string;
  actionLabel?: string;
  actionHref?: string | null;
  // Narrow places like the thread panel.
  compact?: boolean;
}) => {
  const router = useRouter();
  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <div className={styles.card} role="status">
        <span className={styles.icon} aria-hidden>
          <Icon name={icon} size={compact ? 18 : 22} />
        </span>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.text}>{text}</p>
        {actionHref && <Button onClick={() => router.push(actionHref)}>{actionLabel}</Button>}
      </div>
    </div>
  );
};

/** "Channel not found" vs. a real error message from the server. */
export const isNotFound = (error: string | null | undefined) =>
  !error || /not found|404|no access|not a member/i.test(error);
