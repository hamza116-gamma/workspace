'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';
import { createConversation } from '@/lib/conversations';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { PresenceState, User } from '@/types/user';
import styles from './ProfileCard.module.css';

const PRESENCE_LABEL: Record<PresenceState, string> = {
  ACTIVE: 'Active',
  AWAY: 'Away',
  DND: 'Do not disturb',
  OFFLINE: 'Offline',
};

/** Profile card content: presence, title, status, email and "Message". */
export const ProfileCard = ({ user, onNavigate }: { user: User; onNavigate?: () => void }) => {
  const router = useRouter();
  const { user: me } = useAuth();
  const presenceMap = usePresence();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const presence = presenceMap[user.id] ?? user.presence ?? 'OFFLINE';
  const isMe = me?.id === user.id;
  const title = [user.jobTitle, user.department].filter(Boolean).join(' · ');
  const status = [user.statusEmoji, user.statusMessage].filter(Boolean).join(' ');

  const message = async () => {
    setBusy(true);
    setError('');
    try {
      const { conversation } = await createConversation([user.id]);
      onNavigate?.();
      router.push(`/dm/${conversation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open a conversation');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <Avatar name={user.fullName} src={user.avatarUrl} size={56} presence={presence} />
        <div className={styles.identity}>
          <span className={styles.name}>{user.fullName}</span>
          {title && <span className={styles.title}>{title}</span>}
          <span className={styles.presence}>
            <span className={`${styles.dot} ${styles[presence]}`} aria-hidden />
            {PRESENCE_LABEL[presence]}
          </span>
        </div>
      </div>
      {status && <p className={styles.status}>{status}</p>}
      {user.email && (
        <a className={styles.email} href={`mailto:${user.email}`}>
          <Icon name="at" size={13} />
          {user.email}
        </a>
      )}
      {error && <p className={styles.error}>{error}</p>}
      {isMe ? (
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            onNavigate?.();
            router.push('/profile');
          }}
        >
          View your profile
        </Button>
      ) : (
        <Button fullWidth loading={busy} onClick={() => void message()}>
          <Icon name="message" size={14} /> Message
        </Button>
      )}
    </div>
  );
};
