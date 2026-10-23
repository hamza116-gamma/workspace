'use client';

import { useMentionables } from '@/hooks/useMentionables';
import { MemberFacepile } from '@/components/conversation/MemberFacepile';
import { Icon } from '@/components/ui/Icon';
import type { Channel } from '@/types/channel';
import styles from './ChannelMembersSummary.module.css';

/** Window event the channel view listens to, to switch to its Members tab. */
export const SHOW_CHANNEL_MEMBERS_EVENT = 'channel:show-members';

// Compact members row for the details drawer. The full list (with add /
// remove / roles) lives in the channel's Members tab, so the drawer no longer
// repeats it - on small screens that list forced the drawer to scroll.
export const ChannelMembersSummary = ({ channel }: { channel: Channel }) => {
  const users = useMentionables({ kind: 'channel', id: channel.id });
  const count = channel.memberCount;
  const label = `${count} ${count === 1 ? 'member' : 'members'}`;
  const openMembers = () => window.dispatchEvent(new Event(SHOW_CHANNEL_MEMBERS_EVENT));

  const body = (
    <>
      <MemberFacepile users={users} total={count} />
      <span className={styles.text}>
        <span className={styles.title}>Members</span>
        <span className={styles.meta}>{label}</span>
      </span>
      {channel.isMember && (
        <span className={styles.action}>
          View all <Icon name="chevron-right" size={14} />
        </span>
      )}
    </>
  );

  return channel.isMember ? (
    <button type="button" className={`${styles.card} ${styles.clickable}`} onClick={openMembers}>
      {body}
    </button>
  ) : (
    <div className={styles.card}>{body}</div>
  );
};
