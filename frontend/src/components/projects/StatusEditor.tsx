'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { updateProject } from '@/lib/projects';
import { STATUS_GROUP_LABELS, type StatusGroup, type TaskStatusDef } from '@/types/task';
import type { Project } from '@/types/project';
import { SettingsCard } from './SettingsCard';
import styles from './ProjectSettings.module.css';

const GROUP_OPTIONS = (Object.keys(STATUS_GROUP_LABELS) as StatusGroup[]).map((value) => ({
  value,
  label: STATUS_GROUP_LABELS[value],
}));

// Row being edited; a new one has no key until it is saved.
type Row = TaskStatusDef & { id: string };
let nextId = 0;
const toRows = (statuses: TaskStatusDef[]) =>
  statuses.map((status) => ({ ...status, id: `row-${(nextId += 1)}` }));

/**
 * The project's statuses (board columns): add, rename, recolour, reorder,
 * change group, remove. Tickets in a removed status must be moved first.
 */
export const StatusEditor = ({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: (project: Project) => void;
}) => {
  const editable = Boolean(project.canManage) && project.status === 'ACTIVE';
  const counts = project.statusCounts ?? {};
  const [rows, setRows] = useState<Row[]>(() => toRows(project.statuses));
  const [moveTo, setMoveTo] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setRows(toRows(project.statuses));
    setMoveTo({});
  }, [project]);

  const patch = (id: string, change: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)));
  const shift = (index: number, by: number) =>
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });

  // Removed statuses that still have tickets: where do they go?
  const keptKeys = new Set(rows.map((row) => row.key).filter(Boolean));
  const orphaned = project.statuses.filter(
    (status) => !keptKeys.has(status.key) && (counts[status.key] ?? 0) > 0,
  );
  const targets = rows
    .filter((row) => row.key)
    .map((row) => ({ value: row.key, label: row.name || 'Untitled' }));

  const save = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { project: next } = await updateProject(project.key, {
        statuses: rows.map(({ key, name, color, group }) => ({ key, name, color, group })),
        moveStatusTo: moveTo,
      });
      onSaved(next);
      setNotice('Statuses saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the statuses');
    } finally {
      setBusy(false);
    }
  };

  const dirty =
    JSON.stringify(rows.map(({ key, name, color, group }) => [key, name, color, group])) !==
    JSON.stringify(
      project.statuses.map(({ key, name, color, group }) => [key, name, color, group]),
    );

  return (
    <SettingsCard
      title="Statuses"
      text={
        <>
          The board&apos;s columns, in order. <b>Counts as</b> tells the app what a status means:
          tickets start in the first <b>To do</b>, and <b>Done</b> ones count as finished.
        </>
      }
      foot={
        editable ? (
          <>
            <span className={styles.grow}>
              {error ? (
                <span className={styles.fail}>{error}</span>
              ) : notice && !dirty ? (
                <span className={styles.ok}>{notice}</span>
              ) : null}
            </span>
            <Button
              variant="secondary"
              onClick={() =>
                setRows((current) => [
                  ...current,
                  ...toRows([
                    { key: '', name: 'New status', color: '#8a94a6', group: 'IN_PROGRESS' },
                  ]),
                ])
              }
            >
              + Add status
            </Button>
            <Button disabled={busy || !dirty} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save statuses'}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className={styles.statusHead} aria-hidden>
        <span />
        <span>Name</span>
        <span>Counts as</span>
        <span className={styles.center}>Tickets</span>
        <span />
      </div>
      <ul className={styles.statusList}>
        {rows.map((row, index) => (
          <li key={row.id} className={styles.statusRow}>
            <input
              type="color"
              aria-label={`Colour of ${row.name}`}
              className={styles.swatch}
              value={row.color}
              disabled={!editable}
              onChange={(event) => patch(row.id, { color: event.target.value })}
            />
            <input
              className={styles.statusName}
              aria-label="Status name"
              value={row.name}
              maxLength={30}
              disabled={!editable}
              onChange={(event) => patch(row.id, { name: event.target.value })}
            />
            <Dropdown
              size="sm"
              ariaLabel={`What ${row.name} counts as`}
              options={GROUP_OPTIONS}
              value={row.group}
              disabled={!editable}
              onChange={(group) => patch(row.id, { group })}
            />
            <span className={styles.statusCount} title="Tickets in this status">
              {row.key ? (counts[row.key] ?? 0) : <span className={styles.newTag}>new</span>}
            </span>
            <span className={styles.statusActions}>
              {editable && (
                <>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label="Move up"
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => shift(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label="Move down"
                    title="Move down"
                    disabled={index === rows.length - 1}
                    onClick={() => shift(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconDanger}`}
                    aria-label={`Remove ${row.name}`}
                    title="Remove"
                    disabled={rows.length === 1}
                    onClick={() =>
                      setRows((current) => current.filter((item) => item.id !== row.id))
                    }
                  >
                    ✕
                  </button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      {orphaned.length > 0 && (
        <div className={styles.moveBox}>
          {orphaned.map((status) => (
            <div key={status.key} className={styles.moveRow}>
              <span>
                <b>{status.name}</b> has {counts[status.key]}{' '}
                {counts[status.key] === 1 ? 'ticket' : 'tickets'}. Move them to
              </span>
              <Dropdown
                size="sm"
                ariaLabel={`Where ${status.name} tickets go`}
                placeholder="Pick a status"
                options={targets}
                value={moveTo[status.key] ?? ''}
                onChange={(value) => setMoveTo((current) => ({ ...current, [status.key]: value }))}
              />
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  );
};
