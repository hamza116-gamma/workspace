'use client';

import { Icon } from '@/components/ui/Icon';
import { useHuddles } from '@/hooks/useHuddles';
import { HuddleWave } from './HuddleWave';
import { HuddleFaces } from './HuddleFaces';
import { talkingLabel } from './talkingLabel';
import type { HuddleTarget } from '@/types/huddle';
import styles from './HuddleJoinBar.module.css';

// In-conversation prompt while a huddle is live and you're not in it.
export const HuddleJoinBar = ({ target }: { target: HuddleTarget | null }) => {
  const { huddleForTarget, isJoined, join, busy } = useHuddles();
  const huddle = huddleForTarget(target);
  if (!huddle || isJoined(huddle.id)) return null;
  const users = huddle.participants.map((participant) => participant.user);

  return (
    <div className={`huddle-surface ${styles.bar}`} role="status">
      <span className={styles.live}>Live</span>
      <HuddleWave size="sm" />
      <HuddleFaces users={users} />
      <span className={styles.text}>{talkingLabel(users)}</span>
      <button
        type="button"
        className={styles.join}
        onClick={() => void join(huddle.id)}
        disabled={busy}
      >
        <Icon name="headphones" size={14} />
        Join
      </button>
    </div>
  );
};
