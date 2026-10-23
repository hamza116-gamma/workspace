'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';
import { usePresence } from '@/hooks/usePresence';
import {
  listInvitations,
  listOrganizationMembers,
  removeOrganizationMember,
  resendInvitation,
  revokeInvitation,
  updateOrganizationMember,
} from '@/lib/organizations';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Pill } from '@/components/ui/Pill';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { InviteMembersDialog } from './InviteMembersDialog';
import { ManageMemberDialog } from './ManageMemberDialog';
import { MembersTable } from './MembersTable';
import { memberRules } from './memberRules';
import { exportMembersCsv } from './exportMembersCsv';
import type { Invitation, OrganizationMember, OrgRole } from '@/types/organization';
import styles from './MembersView.module.css';

const matches = (query: string, ...values: string[]) =>
  values.some((value) => value.toLowerCase().includes(query));

// Member directory (design: #view-members).
export const MembersView = () => {
  const { user } = useAuth();
  const { active } = useOrg();
  const presence = usePresence();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const organizationId = active?.id;
  const rules = memberRules(active?.role, user?.id);
  const { canManage } = rules;

  const load = useCallback(async () => {
    if (!organizationId) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const memberResult = await listOrganizationMembers(organizationId);
      setMembers(memberResult.members);
      if (canManage) {
        const invitationResult = await listInvitations(organizationId);
        setInvitations(invitationResult.invitations);
      } else {
        setInvitations([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load members');
    } finally {
      setLoading(false);
    }
  }, [organizationId, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const needle = query.trim().toLowerCase();
  const shownMembers = useMemo(
    () => members.filter((m) => !needle || matches(needle, m.user.fullName, m.user.email)),
    [members, needle],
  );
  const shownInvites = useMemo(
    () => invitations.filter((i) => !needle || matches(needle, i.email)),
    [invitations, needle],
  );
  const online = members.filter(
    (m) => m.status === 'ACTIVE' && (presence[m.user.id] ?? m.user.presence) !== 'OFFLINE',
  ).length;

  if (!active) {
    return null;
  }

  const managing = members.find((m) => m.id === managingId) ?? null;

  const run = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const onRoleChange = (member: OrganizationMember, role: OrgRole) =>
    void run(() => updateOrganizationMember(active.id, member.user.id, { role }));

  const onToggleStatus = (member: OrganizationMember) => {
    if (
      member.status === 'ACTIVE' &&
      !window.confirm(`Deactivate ${member.user.fullName}? They will be signed out of ${active.name}.`)
    ) {
      return;
    }
    void run(() =>
      updateOrganizationMember(active.id, member.user.id, {
        status: member.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
      }),
    );
  };

  const onRemove = (member: OrganizationMember) => {
    if (window.confirm(`Remove ${member.user.fullName} from ${active.name}?`)) {
      setManagingId(null);
      void run(() => removeOrganizationMember(active.id, member.user.id));
    }
  };

  const actions = (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => exportMembersCsv(shownMembers, shownInvites, `${active.slug || 'members'}-members.csv`)}
      >
        Export
      </Button>
      {canManage && (
        <Button onClick={() => setInviteOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Invite people
        </Button>
      )}
    </>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Directory"
        title="Members"
        sub={
          <>
            Everyone in {active.name}.{' '}
            {canManage ? 'Owners and admins can change roles and remove people.' : ''}
          </>
        }
        actions={actions}
      />

      {error && (
        <div className={styles.mt}>
          <Alert>{error}</Alert>
        </div>
      )}

      <section className={`${styles.card} ${styles.mt}`}>
        <div className={styles.cardHead}>
          <h3>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </h3>
          <Pill tone="ok">{online} online</Pill>
          <div className={styles.spacer} />
          <input
            className={`${styles.field} ${styles.search}`}
            placeholder="Search by name or email"
            aria-label="Search members"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {loading && members.length === 0 ? (
          <div className={styles.center}>
            <Spinner />
          </div>
        ) : shownMembers.length + shownInvites.length === 0 ? (
          <p className={styles.muted}>No one matches “{query}”.</p>
        ) : (
          <MembersTable
            members={shownMembers}
            invitations={shownInvites}
            selfId={user?.id}
            canManageMember={rules.canManageMember}
            onManage={(member) => setManagingId(member.id)}
            onResend={(invitation) => void run(() => resendInvitation(active.id, invitation.id))}
            onRevoke={(invitation) => void run(() => revokeInvitation(active.id, invitation.id))}
          />
        )}
      </section>

      <ManageMemberDialog
        member={managing}
        roles={rules.assignableRoles}
        onClose={() => setManagingId(null)}
        onRoleChange={onRoleChange}
        onToggleStatus={onToggleStatus}
        onRemove={onRemove}
      />

      <InviteMembersDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={load} />
    </div>
  );
};
