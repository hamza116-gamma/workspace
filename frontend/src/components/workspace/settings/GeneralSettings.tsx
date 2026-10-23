'use client';

import { useEffect, useState } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { updateOrganization } from '@/lib/organizations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import type { ChannelType } from '@/types/channel';
import styles from './Settings.module.css';

const NAME_MAX = 80;

export const GeneralSettings = () => {
  const { active, refresh } = useOrg();
  const [name, setName] = useState('');
  const [allowCreate, setAllowCreate] = useState(true);
  const [defaultType, setDefaultType] = useState<ChannelType>('PUBLIC');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (active) {
      setName(active.name);
      setAllowCreate(active.settings.allowMemberChannelCreation);
      setDefaultType(active.settings.defaultChannelType);
    }
  }, [active]);

  if (!active) {
    return null;
  }

  const dirty =
    name.trim() !== active.name ||
    allowCreate !== active.settings.allowMemberChannelCreation ||
    defaultType !== active.settings.defaultChannelType;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateOrganization(active.id, {
        name: name.trim(),
        settings: { allowMemberChannelCreation: allowCreate, defaultChannelType: defaultType },
      });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.card} onSubmit={onSubmit}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>General</h2>
      </div>
      <div className={styles.cardBody}>
        {error && <Alert>{error}</Alert>}
        {saved && !dirty && <Alert tone="success">Settings saved.</Alert>}
        <Input
          label="Workspace name"
          name="workspaceName"
          value={name}
          maxLength={NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <label className={styles.toggleRow}>
          <span>Members can create channels</span>
          <input
            type="checkbox"
            checked={allowCreate}
            onChange={(event) => setAllowCreate(event.target.checked)}
          />
        </label>
        <Select
          label="Default channel type"
          name="defaultChannelType"
          value={defaultType}
          onChange={(event) => setDefaultType(event.target.value as ChannelType)}
        >
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
        </Select>
        <div className={styles.actions}>
          <Button type="submit" loading={saving} disabled={!dirty || !name.trim()}>
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
};
