'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  addChannelMembers,
  listChannelCandidates,
  listChannelMembers,
  removeChannelMember,
} from '@/lib/channels';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Chip } from '@/components/ui/Chip';
import { getInitials } from '@/lib/initials';
import type { Channel, ChannelMember } from '@/types/channel';
import type { User } from '@/types/user';
import styles from './ChannelMembers.module.css';

const initials = (user: User) => getInitials(user.fullName);

export const ChannelMembers = ({
  channel,
  canManage,
  onChanged,
}: {
  channel: Channel;
  canManage: boolean;
  onChanged: () => void;
}) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [candidates, setCandidates] = useState<User[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listChannelMembers(channel.id);
      setMembers(result.members);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load members');
    } finally {
      setLoading(false);
    }
  }, [channel.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = async () => {
    setShowAdd(true);
    setSelected([]);
    try {
      const result = await listChannelCandidates(channel.id);
      setCandidates(result.candidates.map((candidate) => candidate.user));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load candidates');
    }
  };

  const toggleSelected = (userId: string) => {
    setSelected((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const onAdd = async () => {
    setSaving(true);
    setError('');
    try {
      await addChannelMembers(channel.id, selected);
      setShowAdd(false);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add members');
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (userId: string) => {
    setError('');
    try {
      await removeChannelMember(channel.id, userId);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove member');
    }
  };

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          Members <span className={styles.count}>{members.length}</span>
        </h2>
        {canManage && !showAdd && (
          <button type="button" className={styles.add} onClick={() => void openAdd()}>
            Add people
          </button>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {showAdd && (
        <div className={styles.addPanel}>
          {candidates.length === 0 ? (
            <p className={styles.empty}>Everyone in this workspace is already here.</p>
          ) : (
            <ul className={styles.candidates}>
              {candidates.map((candidate) => (
                <li key={candidate.id}>
                  <label className={styles.candidate}>
                    <input
                      type="checkbox"
                      checked={selected.includes(candidate.id)}
                      onChange={() => toggleSelected(candidate.id)}
                    />
                    <span>{candidate.fullName}</span>
                    <span className={styles.candidateEmail}>{candidate.email}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.addActions}>
            <Button variant="secondary" onClick={() => setShowAdd(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onAdd} loading={saving} disabled={selected.length === 0}>
              Add {selected.length > 0 ? selected.length : ''}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.empty}>Loading members…</p>
      ) : (
        <ul className={styles.list}>
          {members.map((member) => (
            <li key={member.id} className={styles.member}>
              {member.user.avatarUrl ? (
                <Image
                  src={member.user.avatarUrl}
                  alt=""
                  width={36}
                  height={36}
                  className={styles.avatar}
                />
              ) : (
                <span className={styles.avatarFallback}>{initials(member.user)}</span>
              )}
              <span className={styles.memberInfo}>
                <span className={styles.memberName}>
                  {member.user.fullName}
                  {member.user.id === user?.id && <span className={styles.you}> · you</span>}
                </span>
                <span className={styles.memberTitle}>
                  {member.user.jobTitle || member.user.email}
                </span>
              </span>
              {member.role === 'MODERATOR' && <Chip tone="neutral">Moderator</Chip>}
              {canManage && !channel.isDefault && member.user.id !== user?.id && (
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => void onRemove(member.user.id)}
                  aria-label={`Remove ${member.user.fullName}`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
