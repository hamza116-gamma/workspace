'use client';

import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/hooks/useAuth';
import { useThreadPanel } from '@/hooks/useThreadPanel';
import { taskAccess, updateTask, type TaskAccess } from '@/lib/tasks';
import { tokensToDisplay } from '@/lib/mentions';
import {
  DEFAULT_STATUSES,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  firstOfGroup,
  type Task,
  type TaskStatusDef,
} from '@/types/task';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { EditTaskDialog } from './EditTaskDialog';
import { dueChip } from '@/lib/taskDue';
import { DUE_CLASS } from './TaskCard';
import cardStyles from './Tasks.module.css';
import styles from './Kanban.module.css';

const sorted = (items: Task[]) => [...items].sort((a, b) => a.position - b.position);
const MAX_AVATARS = 3;

const BoardCard = ({
  task,
  access,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onSaved,
}: {
  task: Task;
  access: TaskAccess;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen?: () => void;
  onSaved: (task: Task) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const canManage = access !== 'none';
  const due = dueChip(task);
  const extra = task.assignees.length - MAX_AVATARS;

  return (
    <article
      className={`${styles.card} ${dragging ? styles.dragging : ''} ${
        task.statusGroup === 'DONE' ? styles.cardDone : ''
      }`}
      style={{ borderLeftColor: TASK_PRIORITY_COLORS[task.priority] }}
      draggable={canManage}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', task.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <div className={styles.cardTop}>
        <span className={styles.key}>{task.key}</span>
        <span
          className={styles.priority}
          style={{ color: TASK_PRIORITY_COLORS[task.priority] }}
          title={`${TASK_PRIORITY_LABELS[task.priority]} priority`}
        >
          <span
            className={styles.priorityDot}
            style={{ background: TASK_PRIORITY_COLORS[task.priority] }}
          />
          {TASK_PRIORITY_LABELS[task.priority]}
        </span>
        {canManage && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setEditing(true)}
            aria-label="Edit task"
            title="Edit task"
          >
            <Icon name="pencil" size={13} />
          </button>
        )}
      </div>

      <button type="button" className={styles.title} onClick={onOpen} disabled={!onOpen}>
        {tokensToDisplay(task.title)}
      </button>
      {task.description && <p className={styles.description}>{task.description}</p>}

      {task.labels.length > 0 && (
        <div className={styles.labels}>
          {task.labels.map((label) => (
            <span key={label} className={styles.label}>
              {label}
            </span>
          ))}
        </div>
      )}

      <div className={styles.cardFoot}>
        {due ? (
          <span className={`${cardStyles.tcDue} ${cardStyles[DUE_CLASS[due.tone]]}`}>
            <Icon name={due.tone === 'done' ? 'checkCircle' : 'clock'} size={12} />
            {due.text}
          </span>
        ) : (
          <span />
        )}
        <span className={styles.avatars}>
          {task.assignees.length === 0 && <span className={styles.unassigned}>Unassigned</span>}
          {task.assignees.slice(0, MAX_AVATARS).map((user) => (
            <span key={user.id} className={styles.avatar} title={user.fullName}>
              <Avatar name={user.fullName} src={user.avatarUrl} size={22} />
            </span>
          ))}
          {extra > 0 && <span className={styles.more}>+{extra}</span>}
        </span>
      </div>

      {editing && (
        <EditTaskDialog
          task={task}
          access={access}
          open={editing}
          onClose={() => setEditing(false)}
          onSaved={onSaved}
        />
      )}
    </article>
  );
};

/**
 * Kanban board: one column per status (a project's own, or the defaults).
 * Drag a card to another column to change its status (only people who may
 * manage the task can drag it). On a mixed board (My tasks) a project
 * ticket takes its project's status in the column's group.
 */
export const KanbanBoard = ({
  tasks,
  statuses = DEFAULT_STATUSES,
  canModerate = false,
  onChange,
  onOpenTask,
}: {
  tasks: Task[];
  statuses?: TaskStatusDef[];
  canModerate?: boolean;
  // Optimistic local update (and rollback) of one task.
  onChange: (task: Task) => void;
  onOpenTask?: (task: Task) => void;
}) => {
  const { user } = useAuth();
  const { openThread } = useThreadPanel();
  const [dragId, setDragId] = useState<string | null>(null);
  const { statusesFor } = useTaskStatuses();
  const [overColumn, setOverColumn] = useState<string | null>(null);
  // Card the dragged one would land before (null = end of the column).
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Column of a task: its status, or (unknown here) the first of its group.
  const columnOf = (task: Task) =>
    statuses.some((status) => status.key === task.status)
      ? task.status
      : firstOfGroup(statuses, task.statusGroup ?? 'TODO').key;
  // Status a task gets in a column: that one if its project has it, else its
  // project's first status of the column's group.
  const statusIn = (task: Task, column: TaskStatusDef) => {
    const own = statusesFor(task.projectId);
    return own.some((status) => status.key === column.key)
      ? column.key
      : firstOfGroup(own, column.group).key;
  };

  // Position between the neighbours where the card is dropped.
  const positionFor = (taskId: string, columnKey: string, before: string | null) => {
    const column = sorted(
      tasks.filter((item) => columnOf(item) === columnKey && item.id !== taskId),
    );
    const index = before ? column.findIndex((item) => item.id === before) : -1;
    if (index === -1) {
      return column.length ? column[column.length - 1].position + 1000 : 0;
    }
    const next = column[index];
    const prev = column[index - 1];
    return prev ? (prev.position + next.position) / 2 : next.position - 1000;
  };

  const move = async (taskId: string, column: TaskStatusDef, before: string | null) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || before === taskId) {
      return;
    }
    const status = statusIn(task, column);
    const position = positionFor(taskId, column.key, before);
    if (task.status === status && task.position === position) {
      return;
    }
    const changes = task.status === status ? { position } : { status, position };
    setError('');
    onChange({
      ...task,
      ...changes,
      ...(changes.status ? { statusGroup: column.group } : {}),
    });
    try {
      const { task: saved } = await updateTask(task.id, changes);
      onChange(saved);
    } catch (err) {
      onChange(task);
      setError(err instanceof Error ? err.message : 'Could not move the task');
    }
  };

  return (
    <div className={styles.wrap}>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.columns}>
        {statuses.map((column) => {
          const status = column.key;
          const items = sorted(tasks.filter((task) => columnOf(task) === status));
          return (
            <section
              key={status}
              className={`${styles.column} ${overColumn === status ? styles.columnOver : ''}`}
              onDragOver={(event) => {
                if (dragId) {
                  event.preventDefault();
                  setOverColumn(status);
                  setBeforeId(null);
                }
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setOverColumn(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData('text/plain') || dragId;
                const before = beforeId;
                setOverColumn(null);
                setDragId(null);
                setBeforeId(null);
                if (id) {
                  void move(id, column, before);
                }
              }}
            >
              <header className={styles.columnHead}>
                <span className={styles.statusDot} style={{ background: column.color }} />
                <span className={styles.columnTitle}>{column.name}</span>
                <span className={styles.count}>{items.length}</span>
              </header>
              <div className={styles.cards}>
                {items.length === 0 && (
                  <div className={styles.empty}>{dragId ? 'Drop here' : 'No tasks'}</div>
                )}
                {items.map((task) => (
                  <div
                    key={task.id}
                    className={`${styles.slot} ${
                      dragId && beforeId === task.id && dragId !== task.id ? styles.slotOver : ''
                    }`}
                    onDragOver={(event) => {
                      if (dragId) {
                        event.preventDefault();
                        event.stopPropagation();
                        setOverColumn(status);
                        setBeforeId(task.id);
                      }
                    }}
                  >
                    <BoardCard
                      key={task.id}
                      task={task}
                      access={taskAccess(task, user?.id, canModerate)}
                      dragging={dragId === task.id}
                      onDragStart={() => setDragId(task.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverColumn(null);
                        setBeforeId(null);
                      }}
                      // Default: open the ticket (card, comments) in the side panel.
                      onOpen={() => (onOpenTask ? onOpenTask(task) : openThread(task.messageId))}
                      onSaved={onChange}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
