'use client';

import { useState } from 'react';
import { updateChannel } from '@/lib/channels';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Dropdown } from '@/components/ui/Dropdown';
import { useOrg } from '@/hooks/useOrg';
import type { Channel } from '@/types/channel';
import styles from './ChannelAboutCard.module.css';

export const ChannelAboutCard = ({
  channel,
  canManage,
  onChanged,
}: {
  channel: Channel;
  canManage: boolean;
  onChanged: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic);
  const [purpose, setPurpose] = useState(channel.purpose);
  const [type, setType] = useState(channel.type);
  const { active } = useOrg();
  // Slack: only workspace owners/admins change visibility; never #general.
  const canChangeType =
    (active?.role === 'OWNER' || active?.role === 'ADMIN') && !channel.isDefault;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateChannel(channel.id, {
        name,
        topic,
        purpose,
        ...(type !== channel.type ? { type } : {}),
      });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update channel');
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    setName(channel.name);
    setTopic(channel.topic);
    setPurpose(channel.purpose);
    setType(channel.type);
    setError('');
    setEditing(false);
  };

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>About</h2>
        {canManage && !editing && (
          <button type="button" className={styles.edit} onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {editing ? (
        <div className={styles.form}>
          <Input
            label="Channel name"
            name="channelName"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            label="Topic"
            name="channelTopic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          />
          <Input
            label="Purpose"
            name="channelPurpose"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
          />
          {canChangeType && (
            <Dropdown
              label="Visibility"
              options={[
                { value: 'PUBLIC', label: 'Public: anyone in the workspace can join' },
                { value: 'PRIVATE', label: 'Private: only invited members' },
              ]}
              value={type}
              onChange={setType}
            />
          )}
          {type === 'PRIVATE' && channel.type === 'PUBLIC' && (
            <p className={styles.warning}>
              People who aren't members will lose access to this channel.
            </p>
          )}
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onSave} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <dl className={styles.details}>
          <div className={styles.row}>
            <dt className={styles.term}>Visibility</dt>
            <dd className={styles.value}>{channel.type === 'PRIVATE' ? 'Private' : 'Public'}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.term}>Purpose</dt>
            <dd className={styles.value}>{channel.purpose || 'No purpose set.'}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.term}>Topic</dt>
            <dd className={styles.value}>{channel.topic || 'No topic set.'}</dd>
          </div>
        </dl>
      )}
    </section>
  );
};
