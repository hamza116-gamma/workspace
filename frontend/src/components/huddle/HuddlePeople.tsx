'use client';

import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import type { Huddle, HuddlePeerMedia } from '@/types/huddle';
import styles from './HuddlePeople.module.css';

const STATUS_LABEL = { RINGING: 'Ringing…', DECLINED: 'Declined', MISSED: 'No answer' };

// Who is in the huddle + invitees (dimmed until they join), "Ring again".
export const HuddlePeople = ({
  huddle,
  myId,
  media,
  myMuted,
  onRingAgain,
}: {
  huddle: Huddle;
  myId?: string;
  media: Record<string, HuddlePeerMedia>;
  myMuted: boolean;
  onRingAgain: (userId: string) => void;
}) => {
  const inside = new Set(huddle.participants.map((p) => p.user.id));
  const invites = huddle.invites.filter((invite) => !inside.has(invite.user.id));
  return (
    <ul className={styles.list}>
      {huddle.participants.map(({ user }) => {
        const micOff = user.id === myId ? myMuted : media[user.id]?.audio === false;
        return (
          <li key={user.id} className={styles.person} title={user.fullName}>
            <Avatar name={user.fullName} src={user.avatarUrl} size={28} />
            {micOff && (
              <span className={styles.micOff}>
                <Icon name="mic-off" size={10} />
              </span>
            )}
          </li>
        );
      })}
      {invites.map((invite) => (
        <li key={invite.user.id} className={`${styles.person} ${styles.invited}`}>
          <Avatar name={invite.user.fullName} src={invite.user.avatarUrl} size={28} />
          <span className={styles.status}>
            {invite.user.fullName.split(' ')[0]} · {STATUS_LABEL[invite.status]}
          </span>
          {invite.status !== 'RINGING' && (
            <button
              type="button"
              className={styles.again}
              onClick={() => onRingAgain(invite.user.id)}
            >
              Ring again
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};
