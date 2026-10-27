'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import { useSocket } from '@/hooks/useSocket';
import { getProject, listProjectTasks } from '@/lib/projects';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { ProjectSettings } from './ProjectSettings';
import { peopleLabel, UNASSIGNED_KEY, type Project } from '@/types/project';
import type { Task } from '@/types/task';
import styles from './Projects.module.css';

const upsert = (tasks: Task[], task: Task) => {
  const index = tasks.findIndex((item) => item.id === task.id);
  if (index === -1) return [task, ...tasks];
  const next = [...tasks];
  next[index] = task;
  return next;
};

/** One project: its board (live) and settings. */
export const ProjectView = ({ projectKey }: { projectKey: string }) => {
  const router = useRouter();
  const { socket } = useSocket();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'board' | 'settings'>('board');
  // Stable object: the dialog reloads its people list when this changes.
  // New tickets are created on the project (any members; nothing in chat).
  const [createTarget, setCreateTarget] = useState<{
    channelId: null;
    conversationId: null;
    projectKey: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await getProject(projectKey);
      // Opened with a former key (renamed project): move to the current one.
      if (result.renamed) {
        router.replace(`/projects/${result.project.key}`);
      }
      setProject(result.project);
      const list = await listProjectTasks(result.project.key);
      setTasks(list.tasks);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Project not found');
    }
  }, [projectKey, router]);

  useEffect(() => {
    void load();
  }, [load]);

  // Settings changed elsewhere (rename, archive, lead...): reload.
  useEffect(() => {
    if (!socket) return;
    const onChanged = (payload: { projectId: string }) => {
      if (payload.projectId === project?.id) void load();
    };
    socket.on('project.changed', onChanged);
    return () => {
      socket.off('project.changed', onChanged);
    };
  }, [socket, project?.id, load]);

  // Live board: join the project room. After a dropped connection, rejoin and
  // reload so no stale cards remain.
  const projectId = project?.id;
  useEffect(() => {
    if (!socket || !projectId) return;
    const join = () => socket.emit('project:join', projectId);
    const onReconnect = () => {
      join();
      void load();
    };
    join();
    socket.io.on('reconnect', onReconnect);
    return () => {
      socket.emit('project:leave', projectId);
      socket.io.off('reconnect', onReconnect);
    };
  }, [socket, projectId, load]);

  useTaskEvents((task, deleted) => {
    if (!project) return;
    const mine = task.projectId === project.id;
    setTasks((current) =>
      deleted || !mine ? current.filter((item) => item.id !== task.id) : upsert(current, task),
    );
  });

  if (error) {
    const missing = /not found/i.test(error);
    return (
      <div className={`${styles.page} ${styles.centerState}`}>
        <div className={styles.stateCard}>
          <span className={styles.stateIcon} aria-hidden>
            <Icon name="task" size={22} />
          </span>
          <h2 className={styles.stateTitle}>
            {missing ? 'Project not found' : 'Couldn’t load this project'}
          </h2>
          <p className={styles.stateText}>
            {missing
              ? 'It may have been deleted, or you’re not one of its people. Ask the project lead to add you.'
              : error}
          </p>
          <Button onClick={() => router.push('/projects')}>Back to projects</Button>
        </div>
      </div>
    );
  }
  if (!project) {
    return (
      <div className={`${styles.page} ${styles.centerState}`}>
        <Spinner />
      </div>
    );
  }

  const canAdd = project.isMember && !project.readOnly;

  return (
    <div className={`${styles.page} ${styles.fill}`}>
      <header className={styles.projectHead}>
        <div>
          <Link href="/projects" className={styles.crumb}>
            Projects
          </Link>
          <h1 className={styles.projectTitle}>
            <span className={styles.key}>{project.key}</span> {project.name}
          </h1>
          <p className={styles.meta}>
            {peopleLabel(project)} · lead {project.lead.fullName} · {tasks.length}{' '}
            {tasks.length === 1 ? 'ticket' : 'tickets'}
          </p>
        </div>
        {canAdd && tab === 'board' && (
          <Button
            size="sm"
            onClick={() =>
              setCreateTarget({ channelId: null, conversationId: null, projectKey: project.key })
            }
          >
            + New ticket
          </Button>
        )}
      </header>

      {project.readOnly && (
        <p className={styles.banner}>
          {project.status === 'ARCHIVED'
            ? 'This project is archived and read-only.'
            : 'This project is read-only.'}
        </p>
      )}

      <nav className={styles.tabs}>
        <button
          type="button"
          className={tab === 'board' ? styles.tabOn : ''}
          onClick={() => setTab('board')}
        >
          Board
        </button>
        <button
          type="button"
          className={tab === 'settings' ? styles.tabOn : ''}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
      </nav>

      {tab === 'board' ? (
        <div className={styles.boardArea}>
          <KanbanBoard
            tasks={tasks}
            onChange={(task) => setTasks((current) => upsert(current, task))}
          />
        </div>
      ) : (
        <ProjectSettings project={project} onSaved={setProject} />
      )}

      <CreateTaskDialog target={createTarget} onClose={() => setCreateTarget(null)} />
    </div>
  );
};
