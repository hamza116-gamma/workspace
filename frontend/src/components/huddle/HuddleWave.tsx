import styles from './HuddleWave.module.css';

// Animated sound-wave bars (transform only, no layout; static with reduced motion).
export const HuddleWave = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => (
  <span className={`${styles.wave} ${styles[size]}`} aria-hidden>
    {[0, 1, 2, 3, 4].map((bar) => (
      <i key={bar} style={{ animationDelay: `${bar * 0.12}s` }} />
    ))}
  </span>
);
