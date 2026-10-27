'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dropdown } from '@/components/ui/Dropdown';
import { useChannels } from '@/hooks/useChannels';
import { useOrg } from '@/hooks/useOrg';
import { createProject } from '@/lib/projects';
import { PROJECT_KEY_PATTERN, suggestProjectKey, type Project } from '@/types/project';
import styles from './Projects.module.css';

/**
 * Admins can pick any joined channel as the home; moderators only channels
 * they moderate (the server enforces the same rule).
 */
export const NewProjectDialog = ({
  open,
  projects,
  onClose,
}: {
  open: boolean;
  // Active projects: their home channels are not offered again.
  projects: Project[];
  onClose: () => void;
}) => {
  const router = useRouter();
  const { channels } = useChannels();
  const { active } = useOrg();
  const isAdmin = active?.role === 'OWNER' || active?.role === 'ADMIN';
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [homeId, setHomeId] = useState('');
  const [linked, setLinked] = useState<string[]>([]);
  const [adopt, setAdopt] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setKey('');
      setKeyTouched(false);
      setHomeId('');
      setLinked([]);
      setAdopt(true);
      setError('');
    }
  }, [open]);

  const taken = useMemo(() => new Set(projects.map((p) => p.homeChannelId)), [projects]);
  const homeOptions = channels
    .filter(
      (channel) =>
        channel.isMember &&
        channel.status === 'ACTIVE' &&
        !taken.has(channel.id) &&
        (isAdmin || channel.membership?.role === 'MODERATOR'),
    )
    .map((channel) => ({
      value: channel.id,
      label: `${channel.type === 'PRIVATE' ? '🔒 ' : '# '}${channel.name}`,
    }));
  const linkOptions = channels
    .filter((channel) => channel.isMember && channel.status === 'ACTIVE' && channel.id !== homeId)
    .map((channel) => ({ value: channel.id, label: `# ${channel.name}` }));

  const keyValue = keyTouched ? key : suggestProjectKey(name);
  const keyError =
    keyValue && !PROJECT_KEY_PATTERN.test(keyValue)
      ? '2-6 letters or digits, starting with a letter'
      : keyValue === 'TASK'
        ? 'TASK is reserved'
        : '';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !keyValue || keyError || !homeId) {
      setError('Name, a valid key and a home channel are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { project } = await createProject({
        name: name.trim(),
        key: keyValue,
        homeChannelId: homeId,
        linkedChannelIds: linked,
        adoptTasks: adopt,
      });
      onClose();
      router.push(`/projects/${project.key}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="New project" onClose={onClose}>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Input
          label="Project name"
          name="project-name"
          value={name}
          maxLength={80}
          autoFocus
          placeholder="Website"
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label="Key"
          name="project-key"
          value={keyValue}
          maxLength={6}
          placeholder="WEB"
          error={keyError || undefined}
          onChange={(event) => {
            setKeyTouched(true);
            setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
          }}
        />
        <p className={styles.hint}>
          Tickets are numbered with it: <b>{keyValue || 'KEY'}-1</b>, <b>{keyValue || 'KEY'}-2</b>…
        </p>
        <Dropdown
          label="Home channel"
          placeholder={homeOptions.length ? 'Pick a channel' : 'No channel available'}
          options={homeOptions}
          value={homeId}
          onChange={setHomeId}
          disabled={homeOptions.length === 0}
        />
        <p className={styles.hint}>
          Its members are the project&apos;s members, and it gets the project board.
          {!isAdmin && ' You can pick channels you moderate.'}
        </p>
        <Dropdown
          multiple
          label="Linked channels (optional)"
          placeholder="None"
          options={linkOptions}
          value={linked}
          onChange={setLinked}
        />
        <label className={styles.check}>
          <input type="checkbox" checked={adopt} onChange={(e) => setAdopt(e.target.checked)} />
          Move the home channel&apos;s existing tasks into this project (their old TASK-n keys keep
          working)
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
