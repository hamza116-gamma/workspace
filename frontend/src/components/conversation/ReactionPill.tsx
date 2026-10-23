'use client';

import { useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { Popover } from '@/components/ui/Popover';
import type { MessageReaction } from '@/types/message';
import styles from './ReactionPill.module.css';

export const ReactionPill = ({
  reaction,
  onToggle,
  tooltip = true,
}: {
  reaction: MessageReaction;
  onToggle: () => void;
  // The "who reacted" hover tooltip is disabled in compact lists (e.g. the
  // pins hover card), where it has no room to display properly.
  tooltip?: boolean;
}) => {
  const { user } = useAuth();
  // Live payloads are viewer-neutral, so "mine" comes from reaction.users.
  const mine = user ? reaction.users.some((item) => item.id === user.id) : reaction.reactedByMe;
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openNow = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
    if (tooltip) {
      setOpen(true);
    }
  };

  const scheduleClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
    }
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`${styles.pill} ${mine ? styles.mine : ''}`}
        onClick={onToggle}
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
        onFocus={openNow}
        onBlur={scheduleClose}
        title={tooltip ? undefined : reactionUsersTitle(reaction)}
      >
        <span className={styles.emoji}>{reaction.emoji}</span>
        <span className={styles.count}>{reaction.count}</span>
      </button>

      {tooltip && (
        <Popover
          open={open}
          anchorRef={ref}
          align="left"
          panelClassName={styles.tooltipPanel}
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
        >
          <p className={styles.title}>
            {reaction.emoji} {reaction.count} {reaction.count === 1 ? 'reaction' : 'reactions'}
          </p>
          <ul className={styles.users}>
            {reaction.users.map((user) => (
              <li key={user.id} className={styles.user}>
                <Avatar name={user.fullName} src={user.avatarUrl} size={26} />
                <span className={styles.userName}>{user.fullName}</span>
              </li>
            ))}
          </ul>
        </Popover>
      )}
    </>
  );
};

const reactionUsersTitle = (reaction: MessageReaction) =>
  reaction.users.map((user) => user.fullName).join(', ');
