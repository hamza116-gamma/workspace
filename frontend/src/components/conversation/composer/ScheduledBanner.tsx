'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useScheduled } from '@/hooks/useScheduled';
import { matchesTarget } from '@/lib/scheduled';
import { formatScheduleTime } from '@/lib/scheduleTimes';
import type { ScheduledMessage, ScheduleTarget } from '@/types/scheduled';
import { ScheduleDialog } from './ScheduleDialog';
import styles from './ScheduledBanner.module.css';

const preview = (content: string) =>
  content
    .replace(/<@[0-9a-fA-F]{24}>/g, '@…')
    .replace(/\s+/g, ' ')
    .slice(0, 80);

/** Above the composer: this chat's scheduled messages with Send now / Reschedule / Cancel. */
export const ScheduledBanner = ({ target }: { target: ScheduleTarget }) => {
  const { items, cancel, sendNow, reschedule } = useScheduled();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<ScheduledMessage | null>(null);
  const [error, setError] = useState('');
  const mine = items.filter((item) => matchesTarget(item, target));

  if (mine.length === 0) {
    return null;
  }

  const run = async (action: () => Promise<void>) => {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const shown = expanded || mine.length === 1 ? mine : [];

  return (
    <div className={styles.banner}>
      <div className={styles.head}>
        <Icon name="clock" size={14} />
        <span className={styles.title}>
          {mine.length === 1
            ? `Message scheduled for ${formatScheduleTime(mine[0].scheduledAt)}`
            : `${mine.length} messages scheduled · next ${formatScheduleTime(mine[0].scheduledAt)}`}
        </span>
        {mine.length > 1 && (
          <button type="button" className={styles.link} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {shown.map((item) => (
        <div key={item.id} className={styles.row}>
          <span className={styles.text} title={item.content}>
            {mine.length > 1 && (
              <span className={styles.when}>{formatScheduleTime(item.scheduledAt)} · </span>
            )}
            {preview(item.content)}
          </span>
          <button
            type="button"
            className={styles.link}
            onClick={() => void run(() => sendNow(item.id))}
          >
            Send now
          </button>
          <button type="button" className={styles.link} onClick={() => setEditing(item)}>
            Reschedule
          </button>
          <button
            type="button"
            className={`${styles.link} ${styles.danger}`}
            onClick={() => void run(() => cancel(item.id))}
          >
            Cancel
          </button>
        </div>
      ))}
      {error && <p className={styles.error}>{error}</p>}
      <ScheduleDialog
        open={Boolean(editing)}
        title="Reschedule message"
        initial={editing ? new Date(editing.scheduledAt) : undefined}
        onClose={() => setEditing(null)}
        onSubmit={(at) => {
          const id = editing?.id;
          setEditing(null);
          if (id) void run(() => reschedule(id, { scheduledAt: at.toISOString() }));
        }}
      />
    </div>
  );
};
