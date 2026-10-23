'use client';

import styles from './TypingIndicator.module.css';

// "{user} is typing…" rendered BELOW the composer (Slack behavior).
export const TypingIndicator = ({ users }: { users: string[] }) => {
  if (users.length === 0) {
    return null;
  }
  return (
    <div className={styles.wrap} aria-live="polite">
      <span className={styles.dots} aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className={styles.text}>
        {users.join(', ')} {users.length === 1 ? 'is' : 'are'} typing…
      </span>
    </div>
  );
};
