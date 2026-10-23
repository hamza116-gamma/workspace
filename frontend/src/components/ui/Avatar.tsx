import Image from 'next/image';
import { getInitials } from '@/lib/initials';
import type { PresenceState } from '@/types/user';
import styles from './Avatar.module.css';

export const Avatar = ({
  name,
  src,
  size = 36,
  presence,
}: {
  name: string;
  src?: string | null;
  size?: number;
  presence?: PresenceState;
}) => (
  <span className={styles.wrap} style={{ width: size, height: size }}>
    {src ? (
      <Image src={src} alt="" width={size} height={size} className={styles.image} />
    ) : (
      <span className={styles.fallback} style={{ fontSize: Math.round(size * 0.36) }}>
        {getInitials(name)}
      </span>
    )}
    {presence && <span className={`${styles.dot} ${styles[presence]}`} aria-hidden />}
  </span>
);
