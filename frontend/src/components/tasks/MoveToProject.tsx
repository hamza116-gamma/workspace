'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { useProjects } from '@/hooks/useProjects';
import { useProjectsEnabled } from '@/hooks/useProjectsEnabled';
import { moveTaskToProject } from '@/lib/tasks';
import type { Task } from '@/types/task';
import styles from './Tasks.module.css';

/**
 * An unassigned chat task can be moved into a project the user is in. It
 * gets the project's next key; the old TASK-n link keeps working.
 */
export const MoveToProject = ({ task }: { task: Task }) => {
  const enabled = useProjectsEnabled();
  const { projects } = useProjects();
  const options = projects
    .filter((p) => p.isMember && !p.readOnly)
    .map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }));
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!enabled || task.projectId || task.locked || options.length === 0) {
    return null;
  }

  const move = async () => {
    setBusy(true);
    setError('');
    try {
      await moveTaskToProject(task.id, projectId);
      setProjectId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move the task');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.moveRow}>
      <Dropdown
        label="Move to project"
        placeholder="Unassigned"
        options={options}
        value={projectId}
        onChange={setProjectId}
      />
      <Button size="sm" disabled={!projectId || busy} onClick={() => void move()}>
        {busy ? 'Moving…' : 'Move'}
      </Button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};
