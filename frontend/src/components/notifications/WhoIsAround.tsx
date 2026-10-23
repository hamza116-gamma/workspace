'use client';

import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { usePresence } from '@/hooks/usePresence';
import { PRESENCE_PILL } from '@/lib/presenceLabel';
import type { OrganizationMember } from '@/types/organization';
import styles from './Activity.module.css';

const ORDER = { ACTIVE: 0, AWAY: 1, DND: 2, OFFLINE: 3 } as const;
const LIMIT = 8;

const roleName = (role: string) => role.charAt(0) + role.slice(1).toLowerCase();

// "Who's around" card: active workspace members with live presence.
export const WhoIsAround = ({ members, selfId }: { members: OrganizationMember[]; selfId?: string }) => {
  const presence = usePresence();
  const people = members
    .filter((member) => member.status === 'ACTIVE' && member.user.id !== selfId)
    .map((member) => ({
      member,
      state: presence[member.user.id] ?? member.user.presence ?? 'OFFLINE',
    }))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state])
    .slice(0, LIMIT);

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h3>Who&apos;s around</h3>
      </div>
      <div className={styles.whoList}>
        {people.length === 0 && <p className={styles.hint}>No one else here yet.</p>}
        {people.map(({ member, state }) => (
          <div key={member.id} className={styles.who}>
            <Avatar name={member.user.fullName} src={member.user.avatarUrl} size={36} />
            <div className={styles.whoBody}>
              <div className={styles.whoName}>{member.user.fullName}</div>
              <div className={styles.hint}>{member.user.jobTitle || roleName(member.role)}</div>
            </div>
            <Pill tone={PRESENCE_PILL[state].tone}>{PRESENCE_PILL[state].label}</Pill>
          </div>
        ))}
      </div>
    </section>
  );
};
