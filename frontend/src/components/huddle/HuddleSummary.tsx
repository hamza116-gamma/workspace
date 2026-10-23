'use client';

import { Icon } from '@/components/ui/Icon';
import { useHuddles } from '@/hooks/useHuddles';
import { useElapsed } from '@/hooks/useElapsed';
import { formatHuddleDuration } from '@/lib/webrtc';
import { HuddleFaces } from './HuddleFaces';
import { talkingLabel } from './talkingLabel';
import type { Message } from '@/types/message';
import styles from './HuddleSummary.module.css';

const isUnanswered = (content: string) =>
  content.startsWith('Missed huddle') || content.startsWith('Huddle declined');

// Call-log card in the chat (one per huddle). Live -> dark card + Join.
export const HuddleSummary = ({ message }: { message: Message }) => {
  const { huddles, isJoined, join, busy } = useHuddles();
  const live = huddles.find((huddle) => huddle.id === message.huddleId) ?? null;
  const elapsed = useElapsed(live?.startedAt);

  if (live) {
    const joined = isJoined(live.id);
    const users = live.participants.map((participant) => participant.user);
    return (
      <div className={`huddle-surface ${styles.card} ${styles.liveCard}`}>
        <span className={styles.iconLive}>
          <Icon name="headphones" size={16} />
        </span>
        <div className={styles.body}>
          <strong>{joined ? "You're in the huddle" : 'Huddle in progress'}</strong>
          <span className={styles.meta}>
            {talkingLabel(users)} &middot; {formatHuddleDuration(elapsed)}
          </span>
        </div>
        <HuddleFaces users={users} size={22} />
        {!joined && (
          <button
            type="button"
            className={styles.join}
            onClick={() => void join(live.id)}
            disabled={busy}
          >
            Join
          </button>
        )}
      </div>
    );
  }

  const missed = isUnanswered(message.content);
  return (
    <div className={styles.card}>
      <span className={`${styles.icon} ${missed ? styles.iconMissed : ''}`}>
        <Icon name={missed ? 'phone-down' : 'headphones'} size={16} />
      </span>
      <div className={styles.body}>
        <strong>{message.content || 'Huddle'}</strong>
      </div>
    </div>
  );
};
