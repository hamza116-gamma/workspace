'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { listProjects } from '@/lib/projects';
import { useSocket } from './useSocket';
import { useProjectsEnabled } from './useProjectsEnabled';
import { DEFAULT_STATUSES, firstOfGroup, type Task, type TaskStatusDef } from '@/types/task';
import type { Project } from '@/types/project';

// One shared map projectId -> statuses for every card, preview and board on
// the page (loaded once, refreshed when any project changes).
let byProject = new Map<string, TaskStatusDef[]>();
let loading: Promise<void> | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const load = () => {
  loading ??= Promise.all([listProjects(false), listProjects(true)])
    .then(([active, archived]) => {
      byProject = new Map(
        [...active.projects, ...archived.projects].map((p) => [p.id, p.statuses]),
      );
      loaded = true;
      notify();
    })
    .catch(() => {})
    .finally(() => {
      loading = null;
    });
  return loading;
};

/** A page that already has a fresh project (board, settings) shares it. */
export const rememberProjectStatuses = (project: Project) => {
  byProject = new Map(byProject).set(project.id, project.statuses);
  notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * statusesFor(projectId): the project's statuses, or the defaults for chat
 * tasks (and while loading / for a project the viewer can't see).
 */
export const useTaskStatuses = () => {
  const enabled = useProjectsEnabled();
  const { socket } = useSocket();
  const map = useSyncExternalStore(
    subscribe,
    () => byProject,
    () => byProject,
  );

  useEffect(() => {
    if (enabled && !loaded) void load();
  }, [enabled]);

  useEffect(() => {
    if (!socket || !enabled) return;
    const refresh = () => void load();
    socket.on('project.changed', refresh);
    return () => {
      socket.off('project.changed', refresh);
    };
  }, [socket, enabled]);

  const statusesFor = useCallback(
    (projectId?: string | null) => (projectId && map.get(projectId)) || DEFAULT_STATUSES,
    [map],
  );

  /** The task's status (by key; a stale key falls back to its group). */
  const statusOf = useCallback(
    (task: Pick<Task, 'projectId' | 'status' | 'statusGroup'>): TaskStatusDef => {
      const list = statusesFor(task.projectId);
      return (
        list.find((status) => status.key === task.status) ??
        DEFAULT_STATUSES.find((status) => status.key === task.status) ??
        firstOfGroup(list, task.statusGroup ?? 'TODO')
      );
    },
    [statusesFor],
  );

  return { statusesFor, statusOf };
};
