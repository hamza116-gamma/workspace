'use client';

import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { Dropdown } from '@/components/ui/Dropdown';
import { listMyTasks } from '@/lib/tasks';
import { useAuth } from '@/hooks/useAuth';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  type Task,
  type TaskPriority,
} from '@/types/task';
import { KanbanBoard } from './KanbanBoard';
import page from '@/components/saved/SavedView.module.css';
import styles from './Tasks.module.css';

type PriorityFilter = 'ALL' | TaskPriority;

const PRIORITY_FILTERS: { value: PriorityFilter; label: string; color?: string }[] = [
  { value: 'ALL', label: 'All priorities' },
  ...(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((value) => ({
    value,
    label: TASK_PRIORITY_LABELS[value],
    color: TASK_PRIORITY_COLORS[value],
  })),
];

/** "My tasks": every task assigned to the viewer, as a Kanban board. */
export const TasksView = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState<PriorityFilter>('ALL');

  // Live: newly assigned tasks appear, unassigned / deleted ones leave.
  useTaskEvents((task, deleted) => {
    // A locked chat copy has no assignees; the full update comes separately.
    if (task.locked) return;
    const mine = !deleted && task.assignees.some((assignee) => assignee.id === user?.id);
    setTasks((current) => {
      const index = current.findIndex((item) => item.id === task.id);
      if (!mine) {
        return current.filter((item) => item.id !== task.id);
      }
      if (index === -1) {
        return [task, ...current];
      }
      const next = [...current];
      next[index] = task;
      return next;
    });
  });

  const load = useCallback(() => {
    listMyTasks().then(
      ({ tasks: next }) => {
        setTasks(next);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const needle = query.trim().toLowerCase();
  const visible = tasks.filter(
    (task) =>
      (priority === 'ALL' || task.priority === priority) &&
      (!needle ||
        task.title.toLowerCase().includes(needle) ||
        task.key.toLowerCase().includes(needle)),
  );
  const open = tasks.filter((task) => task.statusGroup !== 'DONE').length;

  return (
    <div className={`${page.page} ${styles.fillPage}`}>
      <header className={page.header}>
        <span className={page.eyebrow}>Work</span>
        <h1 className={page.title}>My tasks</h1>
        <p className={page.subtitle}>
          {open} open {open === 1 ? 'task' : 'tasks'} assigned to you across channels and direct
          messages. Drag a card to change its status.
        </p>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Icon name="search" size={14} />
          <input
            type="search"
            placeholder="Search tasks"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search tasks"
          />
        </label>
        <Dropdown
          size="sm"
          ariaLabel="Filter by priority"
          options={PRIORITY_FILTERS}
          value={priority}
          onChange={setPriority}
        />
      </div>

      {loading ? (
        <div className={page.center}>
          <Spinner />
        </div>
      ) : tasks.length === 0 ? (
        <div className={page.emptyCard}>
          <span className={page.emptyIcon} aria-hidden>
            <Icon name="task" size={20} />
          </span>
          <p className={page.emptyTitle}>No tasks assigned to you</p>
          <p className={page.empty}>
            Tasks people assign to you in channels and DMs will show up here.
          </p>
        </div>
      ) : (
        <KanbanBoard
          tasks={visible}
          onChange={(task) =>
            setTasks((current) => current.map((item) => (item.id === task.id ? task : item)))
          }
        />
      )}
    </div>
  );
};
