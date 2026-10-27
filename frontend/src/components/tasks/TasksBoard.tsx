'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import { listChannelTasks, listConversationTasks } from '@/lib/tasks';
import { Dropdown } from '@/components/ui/Dropdown';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/hooks/useAuth';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  type Task,
  type TaskPriority,
} from '@/types/task';
import { CreateTaskDialog } from './CreateTaskDialog';
import { KanbanBoard } from './KanbanBoard';
import styles from './Tasks.module.css';

type Who = 'ALL' | 'ME' | 'UNASSIGNED';

const WHO_OPTIONS: { value: Who; label: string }[] = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'ME', label: 'Assigned to me' },
  { value: 'UNASSIGNED', label: 'Unassigned' },
];

const PRIORITY_FILTERS: { value: 'ALL' | TaskPriority; label: string; color?: string }[] = [
  { value: 'ALL', label: 'All priorities' },
  ...(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((value) => ({
    value,
    label: TASK_PRIORITY_LABELS[value],
    color: TASK_PRIORITY_COLORS[value],
  })),
];

const upsert = (tasks: Task[], task: Task) => {
  const index = tasks.findIndex((item) => item.id === task.id);
  if (index === -1) {
    return [task, ...tasks];
  }
  const next = [...tasks];
  next[index] = task;
  return next;
};

/** Tasks tab of a channel / DM: a live Kanban board. */
export const TasksBoard = ({
  channelId = null,
  conversationId = null,
  canModerate = false,
  canCreate = true,
  onOpenTask,
}: {
  channelId?: string | null;
  conversationId?: string | null;
  canModerate?: boolean;
  canCreate?: boolean;
  // Jump to the task card in the chat (Messages tab).
  onOpenTask?: (task: Task) => void;
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [who, setWho] = useState<Who>('ALL');
  const [priority, setPriority] = useState<'ALL' | TaskPriority>('ALL');
  const [target, setTarget] = useState<{
    channelId: string | null;
    conversationId: string | null;
  } | null>(null);

  const load = useCallback(() => {
    const request = channelId
      ? listChannelTasks(channelId)
      : listConversationTasks(conversationId!);
    request.then(
      ({ tasks: next }) => {
        setTasks(next);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [channelId, conversationId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useTaskEvents((task, deleted) => {
    const here = channelId ? task.channelId === channelId : task.conversationId === conversationId;
    if (here) {
      setTasks((current) =>
        deleted ? current.filter((item) => item.id !== task.id) : upsert(current, task),
      );
    }
  });

  const needle = query.trim().toLowerCase();
  const visible = tasks.filter(
    (task) =>
      (priority === 'ALL' || task.priority === priority) &&
      (who === 'ALL' ||
        (who === 'UNASSIGNED'
          ? task.assignees.length === 0
          : task.assignees.some((assignee) => assignee.id === user?.id))) &&
      (!needle ||
        task.title.toLowerCase().includes(needle) ||
        task.key.toLowerCase().includes(needle) ||
        task.labels.some((label) => label.includes(needle))),
  );

  return (
    <div className={styles.board}>
      <div className={styles.boardHead}>
        <div>
          <h2 className={styles.boardTitle}>Tasks</h2>
          <span className={styles.muted}>
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} · drag a card to change its
            status
          </span>
        </div>
      </div>

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
          ariaLabel="Filter by assignee"
          options={WHO_OPTIONS}
          value={who}
          onChange={setWho}
        />
        <Dropdown
          size="sm"
          ariaLabel="Filter by priority"
          options={PRIORITY_FILTERS}
          value={priority}
          onChange={setPriority}
        />
        {canCreate && (
          <Button
            size="sm"
            className={styles.newTask}
            onClick={() => setTarget({ channelId, conversationId })}
          >
            + New task
          </Button>
        )}
      </div>

      {loading ? (
        <div className={styles.boardEmpty}>
          <Spinner />
        </div>
      ) : (
        <KanbanBoard
          tasks={visible}
          canModerate={canModerate}
          onChange={(task) => setTasks((current) => upsert(current, task))}
          onOpenTask={onOpenTask}
        />
      )}

      <CreateTaskDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
};
