'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/hooks/useOrg';
import { createOrganization } from '@/lib/organizations';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import styles from './CreateWorkspaceDialog.module.css';

export const CreateWorkspaceDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const router = useRouter();
  const { refresh } = useOrg();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await createOrganization(name);
      await refresh();
      onClose();
      setName('');
      router.push('/channels');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create workspace');
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title="Create a workspace" onClose={onClose}>
      <p className={styles.hint}>
        A workspace is where your team&apos;s channels and conversations live.
      </p>
      <form className={styles.form} onSubmit={onSubmit}>
        {error && <Alert>{error}</Alert>}
        <Input
          label="Workspace name"
          name="workspaceName"
          required
          placeholder="e.g. Acme Inc."
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className={styles.actions}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
};
