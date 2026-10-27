'use client';

import { Icon } from '@/components/ui/Icon';
import styles from './TypingIndicator.module.css';

// "A", "A and B", "A, B and C" (null when there are more: too long to list).
const names = (users: string[]) => {
  if (users.length === 1) return users[0];
  if (users.length === 2) return `${users[0]} and ${users[1]}`;
  if (users.length === 3) return `${users[0]}, ${users[1]} and ${users[2]}`;
  return null;
};

const typingText = (users: string[]) => {
  const list = names(users);
  if (!list) return 'Several people are typing…';
  return `${list} ${users.length === 1 ? 'is' : 'are'} typing…`;
};

const recordingText = (users: string[]) => {
  const list = names(users);
  if (!list) return 'Several people are recording audio…';
  return `${list} ${users.length === 1 ? 'is' : 'are'} recording audio…`;
};

/**
 * One pill above the composer for what others are doing: recording a clip
 * (mic, first: the slower signal) and/or typing (dots).
 */
export const TypingIndicator = ({
  users,
  recording = [],
}: {
  users: string[];
  recording?: string[];
}) => {
  if (users.length === 0 && recording.length === 0) {
    return null;
  }

  // Lots going on at once: keep the pill short; hover lists everyone.
  const busy = users.length + recording.length > 4 && users.length > 0 && recording.length > 0;
  const title = [
    recording.length ? `Recording: ${recording.join(', ')}` : '',
    users.length ? `Typing: ${users.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={styles.wrap} aria-live="polite" title={title}>
      {recording.length > 0 && (
        <span className={styles.mic} aria-hidden>
          <Icon name="mic" size={12} />
        </span>
      )}
      {recording.length === 0 && (
        <span className={styles.dots} aria-hidden>
          <i />
          <i />
          <i />
        </span>
      )}
      <span className={styles.text}>
        {busy ? (
          'Several people are active…'
        ) : (
          <>
            {recording.length > 0 && (
              <span className={styles.recordingText}>{recordingText(recording)}</span>
            )}
            {recording.length > 0 && users.length > 0 && (
              <span className={styles.sep} aria-hidden>
                ·
              </span>
            )}
            {users.length > 0 && typingText(users)}
          </>
        )}
      </span>
    </div>
  );
};
