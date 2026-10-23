'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { listOrganizationMembers, transferOwnership } from '@/lib/organizations';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import type { Organization, OrganizationMember } from '@/types/organization';
import styles from './Settings.module.css';

export const TransferOwnershipDialog = ({
  open,
  organization,
  onClose,
  onDone,
}: {
  open: boolean;
  organization: Organization;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [userId, setUserId] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setConfirm('');
    setError('');
    listOrganizationMembers(organization.id)
      .then((result) => {
        const eligible = result.members.filter(
          (member) => member.status === 'ACTIVE' && member.user.id !== user?.id,
        );
        setMembers(eligible);
        setUserId(eligible[0]?.user.id ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load members'));
  }, [open, organization.id, user?.id]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await transferOwnership(organization.id, userId, confirm.trim());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to transfer ownership');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Transfer ownership" onClose={onClose}>
      <form className={styles.stack} onSubmit={onSubmit}>
        <p className={styles.hint}>
          The new owner gets full control of {organization.name}. You will become an Admin.
        </p>
        {error && <Alert>{error}</Alert>}
        {members.length === 0 ? (
          <p className={styles.hint}>There is no other active member to transfer to.</p>
        ) : (
          <>
            <Select
              label="New owner"
              name="newOwner"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            >
              {members.map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.fullName} ({member.user.email})
                </option>
              ))}
            </Select>
            <Input
              label={`Type "${organization.name}" to confirm`}
              name="confirmName"
              value={confirm}
              autoComplete="off"
              onChange={(event) => setConfirm(event.target.value)}
            />
          </>
        )}
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            loading={busy}
            disabled={!userId || confirm.trim() !== organization.name}
          >
            Transfer ownership
          </Button>
        </div>
      </form>
    </Modal>
  );
};
