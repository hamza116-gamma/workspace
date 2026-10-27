'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import { useSocket } from '@/hooks/useSocket';
import { listUnassignedTasks } from '@/lib/tasks';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { UNASSIGNED_KEY } from '@/types/project';
import type { Task } from '@/types/task';
import styles from './Projects.module.css';

const upsert = (tasks: Task[], task: Task) => {
  const index = tasks.findIndex((item) => item.id === task.id);
  if (index === -1) return [task, ...tasks];
  const next = [...tasks];
  next[index] = task;
  return next;
};

// Stable: the dialog reloads its people when the target object changes.
const NEW_TASK_TARGET = { channelId: null, conversationId: null, pickChannel: true };

/**
 * The built-in "Unassigned" board: tasks in no project, from the chats the
 * viewer can read. Not a real project (no members or settings).
 */
export const UnassignedView = () => {
  const { socket } = useSocket();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setTasks((await listUnassignedTasks()).tasks);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tasks');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // After a dropped connection, reload so no stale cards remain.
  useEffect(() => {
    if (!socket) return;
    const onReconnect = () => void load();
    socket.io.on('reconnect', onReconnect);
    return () => {
      socket.io.off('reconnect', onReconnect);
    };
  }, [socket, load]);

  // Chat tasks update live; one moved into a project leaves this board.
  useTaskEvents((task, deleted) => {
    setTasks((current) =>
      current === null
        ? current
        : deleted || task.projectId
          ? current.filter((item) => item.id !== task.id)
          : upsert(current, task),
    );
  });

  if (tasks === null && !error) {
    return (
      <div className={`${styles.page} ${styles.centerState}`}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${styles.fill}`}>
      <header className={styles.projectHead}>
        <div>
          <Link href="/projects" className={styles.crumb}>
            Projects
          </Link>
          <h1 className={styles.projectTitle}>
            <span className={styles.key}>{UNASSIGNED_KEY}</span> Unassigned
          </h1>
          <p className={styles.meta}>
            Tasks from your chats that are in no project · {tasks?.length ?? 0}{' '}
            {tasks?.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          + New task
        </Button>
      </header>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.boardArea}>
        <KanbanBoard
          tasks={tasks ?? []}
          onChange={(task) => setTasks((current) => upsert(current ?? [], task))}
        />
      </div>
      <CreateTaskDialog
        target={creating ? NEW_TASK_TARGET : null}
        onClose={() => setCreating(false)}
        onCreated={(task) => {
          if (!task.projectId) setTasks((current) => upsert(current ?? [], task));
        }}
      />
    </div>
  );
};
