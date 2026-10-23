'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/hooks/useOrg';
import { leaveOrganization } from '@/lib/organizations';
import { reconnectSocket } from '@/lib/socket';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import type { Organization } from '@/types/organization';
import { TransferOwnershipDialog } from './TransferOwnershipDialog';
import styles from './Settings.module.css';

// Everyone can leave; the last owner must transfer ownership first (the
// server enforces it). Owners also get "Transfer ownership".
export const WorkspaceDangerZone = ({ organization }: { organization: Organization }) => {
  const router = useRouter();
  const { refresh } = useOrg();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isOwner = organization.role === 'OWNER';

  const onLeave = async () => {
    setBusy(true);
    setError('');
    try {
      await leaveOrganization(organization.id);
      setLeaveOpen(false);
      reconnectSocket();
      await refresh();
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to leave the workspace');
    } finally {
      setBusy(false);
    }
  };

  const onTransferred = async () => {
    setTransferOpen(false);
    await refresh();
  };

  return (
    <section className={`${styles.card} ${styles.danger}`}>
      <div className={styles.cardHead}>
        <h2 className={`${styles.cardTitle} ${styles.dangerTitle}`}>Danger zone</h2>
      </div>
      <div className={styles.cardBody}>
        {isOwner && (
          <div className={styles.toggleRow}>
            <div>
              Transfer ownership
              <p className={styles.hint}>Make another member the owner. You become an Admin.</p>
            </div>
            <Button variant="secondary" onClick={() => setTransferOpen(true)}>
              Transfer
            </Button>
          </div>
        )}
        <div className={styles.toggleRow}>
          <div>
            Leave workspace
            <p className={styles.hint}>
              You lose access to its channels and messages until you are invited again.
            </p>
          </div>
          <Button variant="danger" onClick={() => setLeaveOpen(true)}>
            Leave
          </Button>
        </div>
      </div>

      <Modal
        open={leaveOpen}
        title={`Leave ${organization.name}?`}
        onClose={() => setLeaveOpen(false)}
      >
        <div className={styles.stack}>
          <p className={styles.hint}>
            {isOwner
              ? 'If you are the last owner, transfer ownership before leaving.'
              : 'You can rejoin only with a new invitation or the invite link.'}
          </p>
          {error && <Alert>{error}</Alert>}
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setLeaveOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void onLeave()}>
              Leave workspace
            </Button>
          </div>
        </div>
      </Modal>

      {isOwner && (
        <TransferOwnershipDialog
          open={transferOpen}
          organization={organization}
          onClose={() => setTransferOpen(false)}
          onDone={() => void onTransferred()}
        />
      )}
    </section>
  );
};
