'use client';

import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { listHuddleCandidates } from '@/lib/huddles';
import { HuddleControlButton } from './HuddleControls';
import type { User } from '@/types/user';
import styles from './HuddleAddPeople.module.css';

// "+" in the huddle box: chat members not in the huddle; clicking rings them.
export const HuddleAddPeople = ({
  huddleId,
  onInvite,
}: {
  huddleId: string;
  onInvite: (userIds: string[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setUsers(null);
    setError(null);
    listHuddleCandidates(huddleId).then(
      (result) => !cancelled && setUsers(result.users),
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [open, huddleId]);

  return (
    <span className={styles.anchor}>
      <HuddleControlButton
        icon="plus"
        label="Add people"
        onClick={() => setOpen((value) => !value)}
        active={open}
      />
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Add people to the huddle">
          <p className={styles.title}>Add people</p>
          {error && <p className={styles.empty}>{error}</p>}
          {!error && users === null && <p className={styles.empty}>Loading…</p>}
          {users?.length === 0 && <p className={styles.empty}>Everyone is already here.</p>}
          <ul className={styles.list}>
            {users?.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  className={styles.row}
                  onClick={() => {
                    onInvite([user.id]);
                    setOpen(false);
                  }}
                >
                  <Avatar name={user.fullName} src={user.avatarUrl} size={24} />
                  <span className={styles.name}>{user.fullName}</span>
                  <span className={styles.ring}>Ring</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
};
