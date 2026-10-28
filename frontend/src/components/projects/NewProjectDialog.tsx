'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dropdown } from '@/components/ui/Dropdown';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useAuth } from '@/hooks/useAuth';
import { createProject } from '@/lib/projects';
import {
  PROJECT_KEY_PATTERN,
  suggestProjectKey,
  type Project,
  type ProjectVisibility,
} from '@/types/project';
import styles from './Projects.module.css';

/** Public (whole workspace) or private (picked people). Shared with Settings. */
export const VisibilityPick = ({
  value,
  onChange,
  disabled = false,
}: {
  value: ProjectVisibility;
  onChange: (value: ProjectVisibility) => void;
  disabled?: boolean;
}) => (
  <div className={styles.modePick} role="radiogroup" aria-label="Visibility">
    <span className={styles.modeLabel}>Visibility</span>
    <div className={styles.segment}>
      {(['PRIVATE', 'PUBLIC'] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={value === option ? styles.on : ''}
          disabled={disabled}
          onClick={() => onChange(option)}
        >
          {option === 'PRIVATE' ? '🔒 Private' : 'Public'}
        </button>
      ))}
    </div>
  </div>
);

/** A project is a name, a key and its people; only they can see it. */
export const NewProjectDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  projects?: Project[];
  onClose: () => void;
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const memberOptions = useOrgMembers()
    .filter((member) => member.status === 'ACTIVE' && member.user.id !== user?.id)
    .map((member) => ({ value: member.user.id, label: member.user.fullName }));
  const [people, setPeople] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<ProjectVisibility>('PRIVATE');
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setKey('');
      setKeyTouched(false);
      setPeople([]);
      setVisibility('PRIVATE');
      setError('');
    }
  }, [open]);

  const keyValue = keyTouched ? key : suggestProjectKey(name);
  const keyError =
    keyValue && !PROJECT_KEY_PATTERN.test(keyValue)
      ? '2-6 letters or digits, starting with a letter'
      : keyValue === 'TASK'
        ? 'TASK is reserved'
        : '';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !keyValue || keyError) {
      setError('A name and a valid key are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { project } = await createProject({
        name: name.trim(),
        key: keyValue,
        visibility,
        ...(visibility === 'PRIVATE' ? { memberIds: people } : {}),
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
        <VisibilityPick value={visibility} onChange={setVisibility} />
        {visibility === 'PRIVATE' ? (
          <>
            <Dropdown
              multiple
              label="People"
              placeholder="Just you"
              options={memberOptions}
              value={people}
              onChange={setPeople}
            />
            <p className={styles.hint}>
              Only you and the people you add can see this project and its tickets.
            </p>
          </>
        ) : (
          <p className={styles.hint}>
            Everyone in the workspace is a member, including people who join later.
          </p>
        )}
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
