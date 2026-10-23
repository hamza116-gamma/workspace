'use client';

import Image from 'next/image';
import { getInitials } from '@/lib/initials';
import type { User } from '@/types/user';
import styles from './MemberFacepile.module.css';

// Soft tint pairs from the demo facepile (bg / ink).
const TINTS = [
  ['#EDE7F6', '#5B4BC4'],
  ['#FDEBD3', '#9C640C'],
  ['#E4F1F6', '#1F6B85'],
  ['#E8F0E4', '#3E6B32'],
];

const tintOf = (id: string) => {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return TINTS[Math.abs(hash) % TINTS.length];
};

/** First three member avatars + "+N" tile (demo .facepile). */
export const MemberFacepile = ({
  users,
  total,
  onClick,
}: {
  users: User[];
  total: number;
  onClick?: () => void;
}) => {
  if (total === 0) {
    return null;
  }
  const shown = users.slice(0, 3);
  const rest = Math.max(0, total - shown.length);
  const label = `${total} ${total === 1 ? 'member' : 'members'}`;

  return (
    <button type="button" className={styles.pile} onClick={onClick} title={label} aria-label={`View ${label}`}>
      {shown.map((user) => {
        const [bg, ink] = tintOf(user.id);
        return user.avatarUrl ? (
          <Image key={user.id} src={user.avatarUrl} alt="" width={26} height={26} className={styles.face} />
        ) : (
          <span key={user.id} className={styles.face} style={{ background: bg, color: ink }}>
            {getInitials(user.fullName)}
          </span>
        );
      })}
      {rest > 0 && (
        <span className={`${styles.face} ${styles.more}`}>
          {shown.length > 0 ? `+${rest}` : rest}
        </span>
      )}
    </button>
  );
};
