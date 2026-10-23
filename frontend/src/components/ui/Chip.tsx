import styles from './Chip.module.css';

type Tone = 'neutral' | 'good' | 'data' | 'warn';

export const Chip = ({
  tone = 'neutral',
  dot = false,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
}) => (
  <span className={`${styles.chip} ${styles[tone]}`}>
    {dot && <span className={styles.dot} aria-hidden />}
    {children}
  </span>
);
