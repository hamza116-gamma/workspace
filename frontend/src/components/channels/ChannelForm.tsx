'use client';

import { FormEvent, useEffect, useState } from 'react';
import { addChannelMembers, createChannel } from '@/lib/channels';
import { listOrganizationMembers } from '@/lib/organizations';
import { useChannels } from '@/hooks/useChannels';
import { useOrg } from '@/hooks/useOrg';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import type { Channel, ChannelType } from '@/types/channel';
import type { User } from '@/types/user';
import styles from './ChannelForm.module.css';

export const ChannelForm = ({
  onCreated,
  onCancel,
  submitLabel = 'Create channel',
}: {
  onCreated: (channel: Channel) => void;
  onCancel: () => void;
  submitLabel?: string;
}) => {
  const { active } = useOrg();
  const { user } = useAuth();
  const { refresh } = useChannels();
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>(active?.settings.defaultChannelType ?? 'PUBLIC');
  const [topic, setTopic] = useState('');
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [members, setMembers] = useState<User[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  useEffect(() => {
    if (type !== 'PRIVATE' || !active) {
      return;
    }
    setMembersLoading(true);
    listOrganizationMembers(active.id)
      .then((result) =>
        setMembers(
          result.members
            .filter((member) => member.status === 'ACTIVE' && member.user.id !== user?.id)
            .map((member) => member.user),
        ),
      )
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  }, [type, active, user?.id]);

  const toggleMember = (userId: string) =>
    setSelectedMembers((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await createChannel({ name, type, topic, purpose });
      if (type === 'PRIVATE' && selectedMembers.length > 0) {
        await addChannelMembers(result.channel.id, selectedMembers);
      }
      await refresh();
      onCreated(result.channel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create channel');
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {error && <Alert>{error}</Alert>}

      <Input
        label="Name"
        name="name"
        required
        placeholder="e.g. product-design"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <Select
        label="Visibility"
        name="type"
        value={type}
        onChange={(event) => setType(event.target.value as ChannelType)}
      >
        <option value="PUBLIC">Public — anyone in the workspace can join</option>
        <option value="PRIVATE">Private — only invited people can access</option>
      </Select>

      {type === 'PRIVATE' && (
        <div className={styles.members}>
          <p className={styles.membersLabel}>Add people</p>
          <p className={styles.membersHint}>
            Only the people you add can see this channel. You can add more later.
          </p>
          {membersLoading ? (
            <p className={styles.membersHint}>Loading people…</p>
          ) : members.length === 0 ? (
            <p className={styles.membersHint}>No other members in this workspace yet.</p>
          ) : (
            <ul className={styles.memberList}>
              {members.map((member) => (
                <li key={member.id}>
                  <label className={styles.memberRow}>
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => toggleMember(member.id)}
                    />
                    <Avatar name={member.fullName} src={member.avatarUrl} size={28} />
                    <span className={styles.memberName}>{member.fullName}</span>
                    <span className={styles.memberEmail}>{member.email}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Input
        label="Topic"
        name="topic"
        placeholder="What is this channel about?"
        value={topic}
        onChange={(event) => setTopic(event.target.value)}
      />

      <Input
        label="Purpose"
        name="purpose"
        placeholder="How should people use it?"
        value={purpose}
        onChange={(event) => setPurpose(event.target.value)}
      />

      <div className={styles.actions}>
        <Button variant="secondary" type="button" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
