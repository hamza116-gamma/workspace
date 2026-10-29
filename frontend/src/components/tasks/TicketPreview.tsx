'use client';

import { useEffect, useState } from 'react';
import { getTaskByKey } from '@/lib/projects';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import { useSocket } from '@/hooks/useSocket';
import type { Socket } from 'socket.io-client';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  type Task,
} from '@/types/task';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import styles from './Tasks.module.css';

// Ticket keys written in a message: WEB-12, API-3. Upper case only, so normal
// text like "covid-19" is left alone; unknown keys simply show nothing.
const KEY_PATTERN = /\b([A-Z][A-Z0-9]{1,5}-\d{1,6}(?:\.\d{1,4})?)\b/g;
const MAX_PREVIEWS = 3;

export const ticketKeysIn = (content: string, exclude?: string) =>
  [...new Set([...(content || '').matchAll(KEY_PATTERN)].map((match) => match[1]))]
    .filter((key) => key !== exclude)
    .slice(0, MAX_PREVIEWS);

// Live updates for previewed tickets: join their project's room (the server
// checks access). Counted, so a board and previews sharing a project don't
// leave it for each other.
const roomUsers = new Map<string, number>();
export const watchProject = (socket: Socket, projectId: string) => {
  const count = roomUsers.get(projectId) ?? 0;
  roomUsers.set(projectId, count + 1);
  if (count === 0) socket.emit('project:join', projectId);
  return () => {
    const left = (roomUsers.get(projectId) ?? 1) - 1;
    roomUsers.set(projectId, left);
    if (left === 0) socket.emit('project:leave', projectId);
  };
};

// One request per key per page view; null = no access / no such ticket.
const cache = new Map<string, Promise<Task | null>>();
const loadByKey = (key: string) => {
  if (!cache.has(key)) {
    cache.set(
      key,
      getTaskByKey(key).then(
        (result) => result.task,
        () => null,
      ),
    );
  }
  return cache.get(key)!;
};

/**
 * A ticket loaded by key with the viewer's own access, kept live.
 * undefined = loading, null = no access / no such ticket.
 */
export const useTicketByKey = (ticketKey: string) => {
  const [task, setTask] = useState<Task | null | undefined>(undefined);
  const { socket } = useSocket();
  const projectId = task?.projectId ?? null;
  useEffect(() => {
    if (!socket || !projectId) return;
    return watchProject(socket, projectId);
  }, [socket, projectId]);

  useEffect(() => {
    let alive = true;
    const cached = cache.has(ticketKey);
    void loadByKey(ticketKey).then((found) => alive && setTask(found));
    // A preview shown again (e.g. back from a subtask's panel) may have
    // missed live updates while it was gone: show the cached copy at once,
    // then refresh it.
    if (cached) {
      const fresh = getTaskByKey(ticketKey).then(
        (result) => result.task,
        () => null,
      );
      void fresh.then((found) => {
        cache.set(ticketKey, Promise.resolve(found));
        if (alive) setTask(found);
      });
    }
    return () => {
      alive = false;
    };
  }, [ticketKey]);

  useTaskEvents((next, deleted) => {
    if (task && next.id === task.id) {
      // Keep the per-page cache fresh too, so a re-shown preview isn't stale.
      cache.set(ticketKey, Promise.resolve(deleted ? null : next));
      setTask(deleted ? null : next);
    }
  });
  return task;
};

/**
 * Live preview of a ticket mentioned by key. Loaded with the viewer's own
 * access: people who can't see the ticket get nothing (no leak).
 */
export const TicketPreview = ({
  ticketKey,
  onOpen,
}: {
  ticketKey: string;
  onOpen: (task: Task) => void;
}) => {
  const task = useTicketByKey(ticketKey);
  const { statusOf } = useTaskStatuses();
  if (!task) {
    return null;
  }
  const status = statusOf(task);
  return (
    <button type="button" className={styles.preview} onClick={() => onOpen(task)}>
      <span className={styles.previewTop}>
        <b className={styles.chipKey}>{task.key}</b>
        <span className={styles.previewPrio} style={{ color: TASK_PRIORITY_COLORS[task.priority] }}>
          {TASK_PRIORITY_LABELS[task.priority]}
        </span>
        <span className={styles.chipStatus} style={{ color: status.color }}>
          <i style={{ background: status.color }} />
          {status.name}
        </span>
      </span>
      <span className={styles.previewTitle}>{task.title}</span>
      <span className={styles.previewMeta}>
        {task.assignees.length
          ? task.assignees.map((user) => user.fullName).join(', ')
          : 'Unassigned'}
      </span>
    </button>
  );
};
