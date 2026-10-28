'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createMilestone, deleteMilestone, updateMilestone } from '@/lib/projects';
import type { Milestone, Project } from '@/types/project';
import styles from './TaskTable.module.css';
import own from './MilestonesView.module.css';

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'No due date';

// "On track", "Overdue", "Done" from the due date and progress.
const health = (m: Milestone) => {
  if (m.status === 'CLOSED') return { text: 'Closed', tone: 'closed' };
  if (m.total > 0 && m.done === m.total) return { text: 'Done', tone: 'done' };
  if (m.dueDate && new Date(m.dueDate).getTime() < Date.now())
    return { text: 'Overdue', tone: 'late' };
  return { text: 'On track', tone: 'ok' };
};

/** A project's milestones: progress, on-track state, add / close / delete. */
export const MilestonesView = ({
  project,
  milestones,
  onChanged,
  onOpen,
}: {
  project: Project;
  milestones: Milestone[];
  onChanged: () => void;
  // Show this milestone's tickets (List tab, filtered).
  onOpen: (milestone: Milestone) => void;
}) => {
  const canManage = Boolean(project.canManage) && project.status === 'ACTIVE';
  const [name, setName] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={own.wrap}>
      {canManage && (
        <form
          className={own.add}
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            void run(async () => {
              await createMilestone(project.key, {
                name: name.trim(),
                dueDate: due ? new Date(`${due}T23:59:00`).toISOString() : null,
              });
              setName('');
              setDue('');
            });
          }}
        >
          <Input
            hideLabel
            label="Milestone name"
            name="milestone-name"
            placeholder="New milestone, e.g. v1.0 launch"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            hideLabel
            label="Due date"
            name="milestone-due"
            type="date"
            value={due}
            onChange={(event) => setDue(event.target.value)}
          />
          <Button type="submit" disabled={busy || !name.trim()}>
            Add milestone
          </Button>
        </form>
      )}
      {error && <p className={styles.error}>{error}</p>}
      {milestones.length === 0 ? (
        <p className={styles.empty}>
          No milestones yet.{canManage ? ' Add one to group tickets toward a goal.' : ''}
        </p>
      ) : (
        <ul className={own.list}>
          {milestones.map((m) => {
            const state = health(m);
            const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
            return (
              <li key={m.id} className={`${own.card} ${m.status === 'CLOSED' ? own.closed : ''}`}>
                <div className={own.top}>
                  <button type="button" className={own.name} onClick={() => onOpen(m)}>
                    {m.name}
                  </button>
                  <span className={`${own.badge} ${own[state.tone]}`}>{state.text}</span>
                </div>
                <div className={own.meta}>
                  {day(m.dueDate)} · {m.done} / {m.total} done
                </div>
                <div className={own.bar}>
                  <i style={{ width: `${pct}%` }} />
                </div>
                {canManage && (
                  <div className={own.actions}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          updateMilestone(project.key, m.id, {
                            status: m.status === 'OPEN' ? 'CLOSED' : 'OPEN',
                          }),
                        )
                      }
                    >
                      {m.status === 'OPEN' ? 'Close' : 'Reopen'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${m.name}"? Its tickets stay, without a milestone.`,
                          )
                        ) {
                          void run(() => deleteMilestone(project.key, m.id));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
