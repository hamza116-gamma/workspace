'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useElapsed } from '@/hooks/useElapsed';
import { huddleHref } from '@/hooks/useHuddleTitle';
import { formatHuddleDuration } from '@/lib/webrtc';
import type { Huddle } from '@/types/huddle';
import styles from './HuddleBar.module.css';

// Live tag, where the huddle is (link), timer and the minimise chevron.
export const HuddleHeader = ({
  huddle,
  title,
  onMinimize,
}: {
  huddle: Huddle;
  title: string;
  onMinimize: () => void;
}) => {
  const elapsed = useElapsed(huddle.startedAt);
  return (
    <div className={styles.header}>
      <span className={styles.live}>Live</span>
      <Link href={huddleHref(huddle)} className={styles.title}>
        {title}
      </Link>
      <span className={styles.timer}>{formatHuddleDuration(elapsed)}</span>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onMinimize}
        aria-label="Minimise huddle"
        title="Minimise"
      >
        <Icon name="chevron-down" size={16} />
      </button>
    </div>
  );
};
