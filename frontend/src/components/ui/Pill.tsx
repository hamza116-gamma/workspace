import styles from './Pill.module.css';

export type PillTone = 'ok' | 'warn' | 'bad' | 'info' | 'mute';

// Status pill with a leading dot (design: .pill / .pill-*).
export const Pill = ({ tone, children }: { tone: PillTone; children: React.ReactNode }) => (
  <span className={`${styles.pill} ${styles[tone]}`}>
    <i aria-hidden />
    {children}
  </span>
);
