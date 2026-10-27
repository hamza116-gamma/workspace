'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dropdown } from '@/components/ui/Dropdown';
import { deleteTask, listAssignable, updateTask, type TaskAccess } from '@/lib/tasks';
import { useAuth } from '@/hooks/useAuth';
import { MentionInput } from './MentionText';
import { LabelInput } from './LabelInput';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  type Task,
  type TaskPriority,
  type TaskType,
  TASK_TYPE_ICONS,
  TASK_TYPE_LABELS,
  formatEstimate,
  type TaskStatus,
  type TaskStatusDef,
} from '@/types/task';
import type { User } from '@/types/user';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { Subtasks } from './Subtasks';
import styles from './Tasks.module.css';

const TYPE_OPTIONS = (Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((value) => ({
  value,
  label: `${TASK_TYPE_ICONS[value]}  ${TASK_TYPE_LABELS[value]}`,
}));

const PRIORITY_OPTIONS = (Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((value) => ({
  value,
  label: TASK_PRIORITY_LABELS[value],
  color: TASK_PRIORITY_COLORS[value],
}));


// Status choices for a task: its project's statuses (or the defaults).
const statusOptions = (statuses: TaskStatusDef[]) =>
  statuses.map((status) => ({ value: status.key, label: status.name, color: status.color }));

const DESCRIPTION_MAX = 4000;

// "2026-11-01T..." -> "2026-11-01" in local time (for <input type="date">).
const toDateInput = (iso: string | null) => {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Edits a task. Only changed fields are sent (each change is noted in the thread). */
export const EditTaskDialog = ({
  task,
  open,
  mentionNames = [],
  access = 'full',
  onClose,
  onSaved,
}: {
  task: Task;
  open: boolean;
  mentionNames?: string[];
  // Assignees ('progress') only change status and description.
  access?: TaskAccess;
  onClose: () => void;
  onSaved: (task: Task) => void;
}) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [labels, setLabels] = useState<string[]>(task.labels);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [type, setType] = useState<TaskType>(task.type ?? 'TASK');
  const [estimate, setEstimate] = useState(formatEstimate(task.estimateMinutes));
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const { statusesFor } = useTaskStatuses();
  // Two-step delete: first click asks, second click deletes.
  const [confirmDelete, setConfirmDelete] = useState(false);
  // A task with subtasks: delete them too, or keep them as separate tasks.
  const [subtaskChoice, setSubtaskChoice] = useState<'keep' | 'delete'>('keep');
  const [dueDate, setDueDate] = useState(toDateInput(task.dueDate));
  const [assignees, setAssignees] = useState<string[]>([]);
  const [people, setPeople] = useState<User[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const full = access === 'full';

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(task.title);
    setDescription(task.description);
    setLabels(task.labels);
    setPriority(task.priority);
    setType(task.type ?? 'TASK');
    setEstimate(formatEstimate(task.estimateMinutes));
    setStatus(task.status);
    setConfirmDelete(false);
    setDueDate(toDateInput(task.dueDate));
    setAssignees(task.assignees.map((user) => user.id));
    setError('');
    setPeople(null);
    let alive = true;
    listAssignable(task).then(
      (users) => alive && setPeople(users),
      () => alive && setPeople([]),
    );
    return () => {
      alive = false;
    };
    // Reset only when the dialog opens, not on every live update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Deletes the task only; its chat message and thread stay.
  const remove = async () => {
    setSaving(true);
    setError('');
    try {
      await deleteTask(task.id, subtaskChoice);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the task');
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }
    const nextDue = dueDate ? new Date(`${dueDate}T23:59:00`).toISOString() : null;
    const before = task.assignees
      .map((user) => user.id)
      .sort()
      .join(',');
    const changes = {
      ...(title.trim() !== task.title ? { title: title.trim() } : {}),
      ...(description.trim() !== task.description ? { description: description.trim() } : {}),
      ...(priority !== task.priority ? { priority } : {}),
      ...(type !== (task.type ?? 'TASK') ? { type } : {}),
      ...(estimate.trim() !== formatEstimate(task.estimateMinutes)
        ? { estimate: estimate.trim() }
        : {}),
      ...(status !== task.status ? { status } : {}),
      ...(labels.join(',') !== task.labels.join(',') ? { labels } : {}),
      ...(dueDate !== toDateInput(task.dueDate) ? { dueDate: nextDue } : {}),
      ...([...assignees].sort().join(',') !== before ? { assignees } : {}),
    };
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { task: updated } = await updateTask(task.id, changes);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={`Edit ${task.key}`} onClose={onClose}>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        {!full && (
          <p className={styles.muted}>
            You can update the description. The title, priority, due date and assignees are set by
            the task creator or a moderator; ask in the task thread to change them.
          </p>
        )}
        <MentionInput
          label="Title"
          disabled={!full}
          name="edit-task-title"
          value={title}
          names={mentionNames}
          maxLength={200}
          autoFocus
          onChange={setTitle}
        />
        <div className={styles.mentionField}>
          <label htmlFor="edit-task-description" className={styles.mentionLabel}>
            Description <span className={styles.optional}>(optional)</span>
          </label>
          <textarea
            id="edit-task-description"
            className={styles.textarea}
            rows={5}
            maxLength={DESCRIPTION_MAX}
            placeholder="Add details, steps, links…"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <Dropdown
          label="Status"
          options={statusOptions(statusesFor(task.projectId))}
          value={status}
          onChange={setStatus}
        />
        <div className={styles.row}>
          <Dropdown
            label="Priority"
            disabled={!full}
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={setPriority}
          />
          <Input
            label="Due date"
            name="edit-task-due"
            disabled={!full}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>
        <div className={styles.row}>
          <Dropdown
            label="Type"
            disabled={!full}
            options={TYPE_OPTIONS}
            value={type}
            onChange={setType}
          />
          <Input
            label="Estimate"
            name="edit-task-estimate"
            disabled={!full}
            placeholder="e.g. 30m, 2h, 1.5d"
            value={estimate}
            onChange={(event) => setEstimate(event.target.value)}
          />
        </div>
        <LabelInput value={labels} disabled={!full} onChange={setLabels} />
        <Dropdown
          multiple
          label="Assignees"
          placeholder={people === null ? 'Loading people…' : 'Unassigned'}
          disabled={people === null || access === 'progress'}
          options={(people ?? [])
            // Unassigned task: a member may only pick it up themselves.
            .filter((person) => full || person.id === user?.id)
            .map((person) => ({ value: person.id, label: person.fullName }))}
          value={assignees}
          onChange={setAssignees}
        />
        {/* Subtasks save on their own (add / tick right away). */}
        {!task.locked && <Subtasks task={task} onNavigate={onClose} />}
        {confirmDelete && task.subtaskTotal > 0 && (
          <div className={styles.subtaskChoice} role="radiogroup" aria-label="Its subtasks">
            <p className={styles.muted}>
              It has {task.subtaskTotal} {task.subtaskTotal === 1 ? 'subtask' : 'subtasks'}:
            </p>
            <label>
              <input
                type="radio"
                checked={subtaskChoice === 'keep'}
                onChange={() => setSubtaskChoice('keep')}
              />
              Keep them as separate tasks
            </label>
            <label>
              <input
                type="radio"
                checked={subtaskChoice === 'delete'}
                onChange={() => setSubtaskChoice('delete')}
              />
              Delete them too
            </label>
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          {full && (
            <Button
              variant="danger"
              type="button"
              className={styles.deleteButton}
              disabled={saving}
              onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
            >
              {confirmDelete ? 'Click again to delete' : 'Delete task'}
            </Button>
          )}
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
