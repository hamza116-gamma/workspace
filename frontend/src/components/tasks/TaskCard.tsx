'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Dropdown } from '@/components/ui/Dropdown';
import { useAuth } from '@/hooks/useAuth';
import { taskAccess, updateTask } from '@/lib/tasks';
import { TASK_PRIORITY_LABELS, type Task, type TaskStatus, type TaskStatusDef } from '@/types/task';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { MentionText } from './MentionText';
import { dueChip } from '@/lib/taskDue';
import { EditTaskDialog } from './EditTaskDialog';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { EstimateChip, SubtaskProgress, TypeIcon } from './TaskMeta';
import styles from './Tasks.module.css';

// Status choices for a task: its project's statuses (or the defaults).
const statusOptions = (statuses: TaskStatusDef[]) =>
  statuses.map((status) => ({ value: status.key, label: status.name, color: status.color }));

export const DUE_CLASS = {
  later: 'dueLater',
  week: 'dueWeek',
  tomorrow: 'dueTomorrow',
  today: 'dueToday',
  late: 'dueLate',
  done: 'dueDone',
} as const;

/**
 * Task card shown on the task's root message. Updates arrive via socket.
 * Mirrors the backend rule: assignees, the creator and moderators change
 * the status; an unassigned task is open to anyone in the chat.
 */
export const TaskCard = ({
  task: incoming,
  canModerate = false,
  mentionNames = [],
  readOnly = false,
  onOpen,
}: {
  task: Task;
  canModerate?: boolean;
  // Names mentioned in the card's message (highlighted in the title).
  mentionNames?: string[];
  // Static preview (e.g. the delete dialog): no status change, no edit.
  readOnly?: boolean;
  // Opens the ticket (comments, history) in the side panel.
  onOpen?: () => void;
}) => {
  const [task, setTask] = useState(incoming);
  const [syncedAt, setSyncedAt] = useState(incoming.updatedAt);
  // A newer copy from the parent (socket / reload) replaces the local one.
  if (incoming.updatedAt !== syncedAt) {
    setSyncedAt(incoming.updatedAt);
    setTask(incoming);
  }
  const [editing, setEditing] = useState(false);
  const { user } = useAuth();
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [synced, setSynced] = useState<TaskStatus>(task.status);
  const { statusesFor, statusOf } = useTaskStatuses();
  const current = statusOf({ ...task, status });
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);

  // "Show more" only when the clamped description is actually cut off.
  useLayoutEffect(() => {
    const el = descriptionRef.current;
    if (el && !expanded) {
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
    }
  }, [task.description, expanded]);

  // A live update from someone else replaces the local value.
  if (synced !== task.status) {
    setSynced(task.status);
    setStatus(task.status);
  }

  const access = readOnly ? 'none' : taskAccess(task, user?.id, canModerate);
  const canManage = access !== 'none';

  const changeStatus = async (next: TaskStatus) => {
    const before = status;
    setStatus(next);
    setError('');
    try {
      await updateTask(task.id, { status: next });
    } catch (err) {
      setStatus(before);
      setError(err instanceof Error ? err.message : 'Could not update the task');
    }
  };

  const due = dueChip({ dueDate: task.dueDate, statusGroup: current.group });

  return (
    <div className={`${styles.card} ${current.group === 'DONE' ? styles.done : ''}`}>
      <div className={styles.cardHead}>
        <TypeIcon task={task} />
        {onOpen ? (
          <button
            type="button"
            className={`${styles.key} ${styles.keyLink}`}
            onClick={onOpen}
            title={`Open ${task.key}: comments and history`}
          >
            {task.key}
          </button>
        ) : (
          <span className={styles.key}>{task.key}</span>
        )}
        <span className={`${styles.priority} ${styles[`p${task.priority}`] ?? ''}`}>
          {TASK_PRIORITY_LABELS[task.priority]}
        </span>
        <EstimateChip task={task} />
        <span className={styles.status}>
          <Dropdown
            size="sm"
            ariaLabel="Task status"
            options={statusOptions(statusesFor(task.projectId))}
            value={current.key}
            disabled={!canManage}
            onChange={(next) => void changeStatus(next)}
          />
        </span>
        {canManage && (
          <button
            type="button"
            className={styles.editButton}
            onClick={() => setEditing(true)}
            aria-label="Edit task"
            title="Edit task"
          >
            <Icon name="pencil" size={14} />
          </button>
        )}
      </div>
      <div className={styles.cardTitle}>
        <MentionText text={task.title} names={mentionNames} />
      </div>
      {task.description && (
        <>
          <div
            ref={descriptionRef}
            className={`${styles.description} ${expanded ? '' : styles.clamped}`}
          >
            <MentionText text={task.description} names={mentionNames} />
          </div>
          {(overflowing || expanded) && (
            <button
              type="button"
              className={styles.more}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </>
      )}
      {(task.commentCount ?? 0) > 0 && onOpen && (
        <button type="button" className={styles.viewSubtasks} onClick={onOpen}>
          💬 {task.commentCount} {task.commentCount === 1 ? 'comment' : 'comments'}
        </button>
      )}
      {task.subtaskTotal > 0 && (
        // Opens the task's thread, which lists every subtask.
        <button type="button" className={styles.viewSubtasks} onClick={onOpen} disabled={!onOpen}>
          View subtasks
          <SubtaskProgress task={task} />
        </button>
      )}
      {task.labels.length > 0 && (
        <div className={styles.tcLabels}>
          {task.labels.map((label) => (
            <span key={label} className={styles.tcLabel}>
              {label}
            </span>
          ))}
        </div>
      )}
      <div className={styles.cardMeta}>
        <span className={styles.tcPeople}>
          {task.assignees.length === 0 ? (
            <>
              <Icon name="users" size={14} />
              Unassigned
            </>
          ) : (
            <>
              <span className={styles.tcAvatars}>
                {task.assignees.slice(0, 3).map((assignee) => (
                  <span key={assignee.id} className={styles.tcAvatar} title={assignee.fullName}>
                    <Avatar name={assignee.fullName} src={assignee.avatarUrl} size={20} />
                  </span>
                ))}
              </span>
              <span className={styles.tcNames}>
                {task.assignees.map((assignee) => assignee.fullName).join(', ')}
              </span>
            </>
          )}
        </span>
        {due && (
          <span className={`${styles.tcDue} ${styles[DUE_CLASS[due.tone]]}`}>
            <Icon name={due.tone === 'done' ? 'checkCircle' : 'clock'} size={12} />
            {due.text}
          </span>
        )}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <EditTaskDialog
        task={task}
        access={access}
        open={editing}
        mentionNames={mentionNames}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          setTask(updated);
          setSyncedAt(updated.updatedAt);
        }}
      />
    </div>
  );
};
