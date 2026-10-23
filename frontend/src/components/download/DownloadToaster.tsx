'use client';

import { useDownload } from '@/hooks/useDownload';
import { Icon } from '@/components/ui/Icon';
import styles from './DownloadToaster.module.css';

// Slack-like download progress toast (bottom-right), mirroring the upload
// progress style: a live bar + percentage per file.
export const DownloadToaster = () => {
  const { tasks, dismiss } = useDownload();

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrap} aria-live="polite">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`${styles.item} ${task.status === 'done' ? styles.done : ''}`}
        >
          <span className={styles.glyph}>
            <Icon name="file" size={15} />
          </span>
          <span className={styles.info}>
            <span className={styles.name}>{task.name}</span>
            {task.status === 'error' ? (
              <span className={styles.error}>{task.error ?? 'Download failed'}</span>
            ) : (
              <span className={styles.progress}>
                <span
                  className={styles.progressFill}
                  style={{ width: `${Math.round(task.progress * 100)}%` }}
                />
              </span>
            )}
          </span>
          {task.status === 'error' && (
            <>
              <button
                type="button"
                className={styles.close}
                onClick={() => dismiss(task.id)}
                aria-label="Dismiss download error"
                title="Dismiss"
              >
                <Icon name="close" size={13} />
              </button>
              <span className={`${styles.badge} ${styles.errorBadge}`}>×</span>
            </>
          )}
          {task.status === 'downloading' && (
            <span className={styles.badge}>{Math.round(task.progress * 100)}%</span>
          )}
          {task.status === 'done' && <span className={`${styles.badge} ${styles.doneBadge}`}>✓</span>}
        </div>
      ))}
    </div>
  );
};
