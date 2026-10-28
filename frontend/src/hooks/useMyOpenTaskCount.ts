'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useOrg } from './useOrg';
import { useTaskEvents } from './useTaskEvents';
import { listMyTasks } from '@/lib/tasks';

/** Open (not Done) tasks assigned to the viewer; kept live from socket events. */
export const useMyOpenTaskCount = () => {
  const { user } = useAuth();
  const { active } = useOrg();
  // id -> open? (only tasks assigned to the viewer are tracked)
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!active?.id) {
      return;
    }
    let alive = true;
    listMyTasks().then(
      ({ tasks }) =>
        alive &&
        setOpen(Object.fromEntries(tasks.map((task) => [task.id, task.statusGroup !== 'DONE']))),
      () => alive && setOpen({}),
    );
    return () => {
      alive = false;
    };
  }, [active?.id]);

  useTaskEvents((task, deleted) => {
    // A locked chat copy (project ticket seen in chat) has no assignees:
    // nothing to learn from it here.
    if (task.locked) return;
    const mine = !deleted && task.assignees.some((assignee) => assignee.id === user?.id);
    setOpen((current) => {
      const next = { ...current };
      if (mine) {
        next[task.id] = task.statusGroup !== 'DONE';
      } else {
        delete next[task.id];
      }
      return next;
    });
  });

  return Object.values(open).filter(Boolean).length;
};
