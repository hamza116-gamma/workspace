'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Alert } from '@/components/ui/Alert';
import { listConversationCandidates } from '@/lib/conversations';
import type { User } from '@/types/user';
import styles from './MemberPickerDialog.module.css';

export const MemberPickerDialog = ({
  open,
  title,
  submitLabel,
  excludeUserIds = [],
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  excludeUserIds?: string[];
  onClose: () => void;
  onSubmit: (userIds: string[]) => Promise<void>;
}) => {
  const [candidates, setCandidates] = useState<User[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelected([]);
    setError('');
    setLoading(true);
    listConversationCandidates()
      .then((result) => setCandidates(result.candidates.map((candidate) => candidate.user)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load people'))
      .finally(() => setLoading(false));
  }, [open]);

  const excluded = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);
  const available = candidates.filter((candidate) => !excluded.has(candidate.id));

  const toggle = (userId: string) =>
    setSelected((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(selected);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      {error && <Alert>{error}</Alert>}

      {loading ? (
        <p className={styles.muted}>Loading people…</p>
      ) : available.length === 0 ? (
        <p className={styles.muted}>No one else is available to add.</p>
      ) : (
        <ul className={styles.list}>
          {available.map((candidate) => (
            <li key={candidate.id}>
              <label className={styles.row}>
                <input
                  type="checkbox"
                  checked={selected.includes(candidate.id)}
                  onChange={() => toggle(candidate.id)}
                />
                <Avatar name={candidate.fullName} src={candidate.avatarUrl} size={30} />
                <span className={styles.name}>{candidate.fullName}</span>
                <span className={styles.email}>{candidate.email}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void submit()} loading={submitting} disabled={selected.length === 0}>
          {submitLabel}
          {selected.length > 0 ? ` (${selected.length})` : ''}
        </Button>
      </div>
    </Modal>
  );
};
