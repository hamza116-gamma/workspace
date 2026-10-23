'use client';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { usePresence } from '@/hooks/usePresence';
import { daysAgo, monthYear } from '@/lib/relativeDays';
import type { Invitation, OrganizationMember } from '@/types/organization';
import { roleLabel } from './memberRules';
import styles from './MembersView.module.css';

type Props = {
  members: OrganizationMember[];
  invitations: Invitation[];
  selfId?: string;
  canManageMember: (member: OrganizationMember) => boolean;
  onManage: (member: OrganizationMember) => void;
  onResend: (invitation: Invitation) => void;
  onRevoke: (invitation: Invitation) => void;
};

const MemberStatus = ({ member }: { member: OrganizationMember }) => {
  const presence = usePresence();
  if (member.status === 'DISABLED') {
    return <Pill tone="bad">Deactivated</Pill>;
  }
  const state = presence[member.user.id] ?? member.user.presence;
  if (state === 'ACTIVE') {
    return <Pill tone="ok">Active</Pill>;
  }
  return state === 'OFFLINE' ? <Pill tone="mute">Offline</Pill> : <Pill tone="warn">Away</Pill>;
};

// Directory table (design: #view-members table).
export const MembersTable = ({
  members,
  invitations,
  selfId,
  canManageMember,
  onManage,
  onResend,
  onRevoke,
}: Props) => (
  <div className={styles.tblWrap}>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Member</th>
          <th>Role</th>
          <th>Status</th>
          <th>Joined</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.id}>
            <td>
              <div className={styles.who}>
                <Avatar name={member.user.fullName} src={member.user.avatarUrl} size={32} />
                <div className={styles.whoBody}>
                  <div className={styles.name}>
                    {member.user.fullName}
                    {member.user.id === selfId && <span className={styles.hint}> (you)</span>}
                  </div>
                  <div className={styles.hint}>{member.user.email}</div>
                </div>
              </div>
            </td>
            <td>
              <Pill tone={member.role === 'OWNER' || member.role === 'ADMIN' ? 'info' : 'mute'}>
                {roleLabel(member.role)}
              </Pill>
            </td>
            <td>
              <MemberStatus member={member} />
            </td>
            <td className={styles.hint}>{member.joinedAt ? monthYear(member.joinedAt) : '—'}</td>
            <td className={styles.right}>
              {canManageMember(member) && (
                <Button variant="quiet" size="sm" onClick={() => onManage(member)}>
                  Manage
                </Button>
              )}
            </td>
          </tr>
        ))}
        {invitations.map((invitation) => (
          <tr key={invitation.id}>
            <td>
              <div className={styles.who}>
                <span className={styles.unknownAv}>?</span>
                <div className={styles.whoBody}>
                  <div className={`${styles.name} ${styles.pendingName}`}>{invitation.email}</div>
                  <div className={styles.hint}>
                    {invitation.createdAt
                      ? `Invited ${daysAgo(invitation.createdAt)}`
                      : `Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`}
                  </div>
                </div>
              </div>
            </td>
            <td>
              <Pill tone="mute">{roleLabel(invitation.role)}</Pill>
            </td>
            <td>
              <Pill tone="info">Invite pending</Pill>
            </td>
            <td className={styles.hint}>—</td>
            <td className={styles.right}>
              <Button variant="quiet" size="sm" onClick={() => onResend(invitation)}>
                Resend
              </Button>
              <Button variant="quiet" size="sm" className={styles.revoke} onClick={() => onRevoke(invitation)}>
                Revoke
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
