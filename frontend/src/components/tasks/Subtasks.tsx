'use client';

import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { useSocket } from '@/hooks/useSocket';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { useThreadPanel } from '@/hooks/useThreadPanel';
import { createSubtask, getTask, listSubtasks, updateTask } from '@/lib/tasks';
import { firstOfGroup, type Task } from '@/types/task';
import { watchProject } from './TicketPreview';
import styles from './Tasks.module.css';

const byCreated = (a: Task, b: Task) => a.createdAt.localeCompare(b.createdAt);

/**
 * Subtasks of a task, in its side panel: tick to finish, click to open, type
 * a title and press Enter to add. A subtask instead links back to its parent.
 */
export const Subtasks = ({ task }: { task: Task }) => {
  const { openThread } = useThreadPanel();
  const { socket } = useSocket();
  const { statusesFor, statusOf } = useTaskStatuses();
  const [items, setItems] = useState<Task[] | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isSubtask = Boolean(task.parentId);

  useEffect(() => {
    if (isSubtask) return;
    let alive = true;
    listSubtasks(task.id).then(
      (result) => alive && setItems(result.tasks),
      () => alive && setItems([]),
    );
    return () => {
      alive = false;
    };
  }, [task.id, isSubtask]);

  // Project subtasks are announced in the project's room: listen there too.
  const projectId = task.projectId ?? null;
  useEffect(() => {
    if (!socket || !projectId || isSubtask) return;
    return watchProject(socket, projectId);
  }, [socket, projectId, isSubtask]);

  useTaskEvents((next, deleted) => {
    if (next.parentId !== task.id && !items?.some((item) => item.id === next.id)) return;
    setItems((current) => {
      const rest = (current ?? []).filter((item) => item.id !== next.id);
      return deleted || next.parentId !== task.id ? rest : [...rest, next].sort(byCreated);
    });
  });

  if (isSubtask) {
    return (
      <button
        type="button"
        className={styles.parentLink}
        onClick={() =>
          void getTask(task.parentId!).then(
            (result) => openThread(result.task.messageId),
            () => setError('The parent task is not available'),
          )
        }
      >
        ↑ Subtask of its parent task {error && `· ${error}`}
      </button>
    );
  }

  const add = async () => {
    const text = title.trim();
    if (!text) return;
    setBusy(true);
    setError('');
    try {
      const { task: created } = await createSubtask(task.id, { title: text });
      setItems((current) =>
        [...(current ?? []).filter((item) => item.id !== created.id), created].sort(byCreated),
      );
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the subtask');
    } finally {
      setBusy(false);
    }
  };

  // Tick: first "done" status of its project; untick: first "to do".
  const toggle = async (item: Task) => {
    const list = statusesFor(item.projectId);
    const target = firstOfGroup(list, item.statusGroup === 'DONE' ? 'TODO' : 'DONE');
    setError('');
    try {
      const { task: saved } = await updateTask(item.id, { status: target.key });
      setItems((current) => (current ?? []).map((row) => (row.id === saved.id ? saved : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the subtask');
    }
  };

  const done = (items ?? []).filter((item) => item.statusGroup === 'DONE').length;

  return (
    <section className={styles.subtasks} aria-label="Subtasks">
      <header className={styles.subtasksHead}>
        <span>Subtasks</span>
        {items && items.length > 0 && (
          <span className={styles.subtasksCount}>
            {done} / {items.length}
          </span>
        )}
      </header>
      {items === null ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <ul className={styles.subtaskList}>
          {items.map((item) => {
            const status = statusOf(item);
            return (
              <li key={item.id} className={styles.subtaskRow}>
                <input
                  type="checkbox"
                  aria-label={`Done: ${item.title}`}
                  checked={item.statusGroup === 'DONE'}
                  onChange={() => void toggle(item)}
                />
                <button
                  type="button"
                  className={`${styles.subtaskTitle} ${
                    item.statusGroup === 'DONE' ? styles.subtaskDone : ''
                  }`}
                  onClick={() => openThread(item.messageId)}
                  title={`Open ${item.key}`}
                >
                  <span className={styles.subtaskKey}>{item.key}</span> {item.title}
                </button>
                <span className={styles.subtaskStatus} style={{ color: status.color }}>
                  {status.name}
                </span>
                {item.assignees[0] && (
                  <Avatar
                    name={item.assignees[0].fullName}
                    src={item.assignees[0].avatarUrl}
                    size={20}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <input
        className={styles.subtaskInput}
        placeholder="Add a subtask and press Enter"
        value={title}
        maxLength={200}
        disabled={busy}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void add();
          }
        }}
      />
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
};
