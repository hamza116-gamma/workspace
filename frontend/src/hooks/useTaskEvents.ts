'use client';

import { useEffect, useRef } from 'react';
import { useSocket } from './useSocket';
import type { Task } from '@/types/task';

type TaskPayload = { organizationId: string; task: Task };

/** Calls back on task.created / task.updated / task.deleted socket events. */
export const useTaskEvents = (onEvent: (task: Task, deleted: boolean) => void) => {
  const { socket } = useSocket();
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    if (!socket) {
      return;
    }
    const onChange = (payload: TaskPayload) =>
      payload?.task && handler.current(payload.task, false);
    const onDelete = (payload: TaskPayload) => payload?.task && handler.current(payload.task, true);
    socket.on('task.created', onChange);
    socket.on('task.updated', onChange);
    socket.on('task.deleted', onDelete);
    return () => {
      socket.off('task.created', onChange);
      socket.off('task.updated', onChange);
      socket.off('task.deleted', onDelete);
    };
  }, [socket]);
};
