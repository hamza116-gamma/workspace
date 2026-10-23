'use client';

import { useEffect } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/hooks/useAuth';
import { useHuddles } from '@/hooks/useHuddles';
import { useHuddleTitle } from '@/hooks/useHuddleTitle';
import { isDndActive } from '@/lib/dnd';
import { startRingtone } from '@/lib/ringtone';
import { HuddleWave } from './HuddleWave';
import type { HuddleRing } from '@/types/huddle';
import styles from './HuddleRingPopup.module.css';

const RingCard = ({ ring }: { ring: HuddleRing }) => {
  const { user } = useAuth();
  const { join, decline, busy } = useHuddles();
  const title = useHuddleTitle(ring.huddle);
  // Silent in Do Not Disturb (server flag + local check).
  const silent = ring.silent || isDndActive(user);

  useEffect(() => {
    if (silent) return;
    return startRingtone();
  }, [silent]);

  return (
    <div
      className={`huddle-surface ${styles.card}`}
      role="alertdialog"
      aria-label="Incoming huddle"
    >
      <span className={styles.live}>Incoming huddle</span>
      <div className={styles.caller}>
        <span className={styles.ring}>
          <Avatar name={ring.caller.fullName} src={ring.caller.avatarUrl} size={44} />
        </span>
        <div className={styles.text}>
          <strong>{ring.caller.fullName}</strong>
          <span>
            {ring.huddle.channelId ? `in ${title}` : 'is calling you'}
            {silent && ' · silent (paused)'}
          </span>
        </div>
        <HuddleWave size="sm" />
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.decline}
          onClick={() => void decline(ring.huddle.id)}
          disabled={busy}
        >
          Decline
        </button>
        <button
          type="button"
          className={styles.join}
          onClick={() => void join(ring.huddle.id)}
          disabled={busy}
        >
          <Icon name="headphones" size={14} />
          Join
        </button>
      </div>
    </div>
  );
};

// Incoming huddle popup on any page (latest ring on top).
export const HuddleRingPopup = () => {
  const { rings, joinedId } = useHuddles();
  const visible = rings.filter((ring) => ring.huddle.id !== joinedId);
  if (visible.length === 0) return null;
  return (
    <div className={styles.stack}>
      {visible.slice(-2).map((ring) => (
        <RingCard key={ring.huddle.id} ring={ring} />
      ))}
    </div>
  );
};
