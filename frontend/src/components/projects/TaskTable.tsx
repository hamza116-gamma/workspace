'use client';

import { useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { useThreadPanel } from '@/hooks/useThreadPanel';
import { updateTask } from '@/lib/tasks';
import { TypeIcon } from '@/components/tasks/TaskMeta';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  formatEstimate,
  type Task,
  type TaskPriority,
} from '@/types/task';
import type { Milestone, Project } from '@/types/project';
import styles from './TaskTable.module.css';

type SortKey =
  'key' | 'title' | 'status' | 'assignee' | 'priority' | 'due' | 'estimate' | 'milestone';
const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

/**
 * A project's tickets as a sortable table, with filters and changes to
 * several at once (status, milestone, board / backlog). Used for the List
 * and the Backlog tabs.
 */
export const TaskTable = ({
  project,
  tasks,
  milestones,
  mode,
  onChange,
  emptyText,
  initialMilestone = '',
}: {
  project: Project;
  tasks: Task[];
  milestones: Milestone[];
  mode: 'list' | 'backlog';
  onChange: (task: Task) => void;
  emptyText: string;
  initialMilestone?: string;
}) => {
  const { openThread } = useThreadPanel();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'key', dir: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [milestoneFilter, setMilestoneFilter] = useState(initialMilestone);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const statusOf = (task: Task) =>
    project.statuses.find((s) => s.key === task.status) ?? project.statuses[0];
  const milestoneName = (id?: string | null) => milestones.find((m) => m.id === id)?.name ?? '';

  const rows = useMemo(() => {
    const value = (task: Task): string | number => {
      switch (sort.key) {
        case 'key':
          return task.number * 1000 + (Number(task.key.split('.')[1]) || 0);
        case 'title':
          return task.title.toLowerCase();
        case 'status':
          return project.statuses.findIndex((s) => s.key === task.status);
        case 'assignee':
          return task.assignees[0]?.fullName.toLowerCase() ?? '~';
        case 'priority':
          return PRIORITY_RANK[task.priority];
        case 'due':
          return task.dueDate ? new Date(task.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        case 'estimate':
          return task.estimateMinutes ?? Number.MAX_SAFE_INTEGER;
        case 'milestone':
          return milestoneName(task.milestoneId).toLowerCase() || '~';
      }
    };
    return tasks
      .filter((task) => !statusFilter || task.status === statusFilter)
      .filter(
        (task) =>
          !milestoneFilter ||
          (milestoneFilter === 'none' ? !task.milestoneId : task.milestoneId === milestoneFilter),
      )
      .sort((a, b) => {
        const x = value(a);
        const y = value(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
    // milestoneName depends on milestones only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sort, statusFilter, milestoneFilter, milestones, project.statuses]);

  const toggleSort = (key: SortKey) =>
    setSort((current) => ({ key, dir: current.key === key ? (current.dir === 1 ? -1 : 1) : 1 }));
  const allSelected = rows.length > 0 && rows.every((task) => selected.includes(task.id));

  // Same change to every selected ticket.
  const bulk = async (changes: Parameters<typeof updateTask>[1]) => {
    setBusy(true);
    setError('');
    const failed: string[] = [];
    for (const id of selected) {
      try {
        const { task } = await updateTask(id, changes);
        onChange(task);
      } catch {
        failed.push(tasks.find((t) => t.id === id)?.key ?? id);
      }
    }
    setBusy(false);
    setSelected([]);
    if (failed.length) setError(`Couldn’t change ${failed.join(', ')} (no permission?)`);
  };

  const head = (key: SortKey, label: string) => (
    <th>
      <button type="button" className={styles.sort} onClick={() => toggleSort(key)}>
        {label}
        {sort.key === key && <span aria-hidden>{sort.dir === 1 ? ' ↑' : ' ↓'}</span>}
      </button>
    </th>
  );

  const milestoneOptions = milestones
    .filter((m) => m.status === 'OPEN')
    .map((m) => ({ value: m.id, label: m.name }));

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span className={styles.filter}>
          <Dropdown
            size="sm"
            ariaLabel="Filter by status"
            placeholder="All statuses"
            options={[
              { value: '', label: 'All statuses' },
              ...project.statuses.map((s) => ({ value: s.key, label: s.name, color: s.color })),
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </span>
        <span className={styles.filter}>
          <Dropdown
            size="sm"
            ariaLabel="Filter by milestone"
            placeholder="All milestones"
            options={[
              { value: '', label: 'All milestones' },
              { value: 'none', label: 'No milestone' },
              ...milestones.map((m) => ({ value: m.id, label: m.name })),
            ]}
            value={milestoneFilter}
            onChange={setMilestoneFilter}
          />
        </span>
        <span className={styles.count}>
          {rows.length} {rows.length === 1 ? 'ticket' : 'tickets'}
        </span>
      </div>

      {selected.length > 0 && (
        <div className={styles.bulk} role="toolbar" aria-label="Change selected tickets">
          <b>{selected.length} selected</b>
          <span className={styles.filter}>
            <Dropdown
              size="sm"
              ariaLabel="Set status"
              placeholder="Set status…"
              options={project.statuses.map((s) => ({
                value: s.key,
                label: s.name,
                color: s.color,
              }))}
              value=""
              disabled={busy}
              onChange={(status) => void bulk({ status })}
            />
          </span>
          <span className={styles.filter}>
            <Dropdown
              size="sm"
              ariaLabel="Set milestone"
              placeholder="Set milestone…"
              options={[{ value: '', label: 'No milestone' }, ...milestoneOptions]}
              value="__"
              disabled={busy}
              onChange={(milestoneId) => void bulk({ milestoneId })}
            />
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void bulk({ backlog: mode === 'list' })}
          >
            {mode === 'list' ? 'Move to backlog' : 'Move to board'}
          </Button>
          <button type="button" className={styles.clear} onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}

      {rows.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.check}>
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? [] : rows.map((task) => task.id))}
                  />
                </th>
                {head('key', 'Key')}
                {head('title', 'Title')}
                {head('status', 'Status')}
                {head('assignee', 'Assignee')}
                {head('priority', 'Priority')}
                {head('due', 'Due')}
                {head('estimate', 'Estimate')}
                {head('milestone', 'Milestone')}
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => {
                const status = statusOf(task);
                return (
                  <tr key={task.id} className={selected.includes(task.id) ? styles.on : ''}>
                    <td className={styles.check}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${task.key}`}
                        checked={selected.includes(task.id)}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(task.id)
                              ? current.filter((id) => id !== task.id)
                              : [...current, task.id],
                          )
                        }
                      />
                    </td>
                    <td className={styles.key}>
                      <TypeIcon task={task} /> {task.key}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.title}
                        onClick={() => openThread(task.messageId)}
                      >
                        {task.title}
                      </button>
                    </td>
                    <td>
                      <span className={styles.status} style={{ color: status?.color }}>
                        <i style={{ background: status?.color }} />
                        {status?.name}
                      </span>
                    </td>
                    <td>
                      {task.assignees[0] ? (
                        <span className={styles.person}>
                          <Avatar
                            name={task.assignees[0].fullName}
                            src={task.assignees[0].avatarUrl}
                            size={20}
                          />
                          {task.assignees[0].fullName}
                          {task.assignees.length > 1 && ` +${task.assignees.length - 1}`}
                        </span>
                      ) : (
                        <span className={styles.muted}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ color: TASK_PRIORITY_COLORS[task.priority] }}>
                      {TASK_PRIORITY_LABELS[task.priority]}
                    </td>
                    <td>{day(task.dueDate)}</td>
                    <td>{formatEstimate(task.estimateMinutes)}</td>
                    <td className={styles.muted}>{milestoneName(task.milestoneId)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
