'use client';

import { FormEvent, useState } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { createInvitation } from '@/lib/organizations';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { OrgRole } from '@/types/organization';
import styles from './InviteMembersDialog.module.css';

const INVITE_ROLES: OrgRole[] = ['ADMIN', 'MODERATOR', 'MEMBER'];
const roleLabel = (role: OrgRole) => role.charAt(0) + role.slice(1).toLowerCase();

export const InviteMembersDialog = ({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) => {
  const { active } = useOrg();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('MEMBER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!active) {
    return null;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await createInvitation(active.id, { email, role });
      setEmail('');
      setRole('MEMBER');
      onInvited();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title={`Invite people to ${active.name}`} onClose={onClose}>
      <form className={styles.form} onSubmit={onSubmit}>
        {error && <Alert>{error}</Alert>}
        <Input
          label="Email"
          name="inviteEmail"
          type="email"
          required
          placeholder="name@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Select
          label="Role"
          name="inviteRole"
          value={role}
          onChange={(event) => setRole(event.target.value as OrgRole)}
        >
          {INVITE_ROLES.map((option) => (
            <option key={option} value={option}>
              {roleLabel(option)}
            </option>
          ))}
        </Select>
        <p className={styles.hint}>
          The invitee must sign in with this email. If email delivery isn&apos;t configured, the
          invite link is printed in the backend console.
        </p>
        <div className={styles.actions}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Send invitation
          </Button>
        </div>
      </form>
    </Modal>
  );
};
