'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import { useSocket } from '@/hooks/useSocket';
import { watchProject } from '@/components/tasks/TicketPreview';
import { rememberProjectStatuses } from '@/hooks/useTaskStatuses';
import { getProject, listMilestones, listProjectTasks } from '@/lib/projects';
import { TaskTable } from './TaskTable';
import { MilestonesView } from './MilestonesView';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { ProjectSettings } from './ProjectSettings';
import { peopleLabel, UNASSIGNED_KEY, type Milestone, type Project } from '@/types/project';
import type { Task } from '@/types/task';
import styles from './Projects.module.css';
import { NotFoundState, isNotFound } from '@/components/ui/NotFoundState';

const upsert = (tasks: Task[], task: Task) => {
  const index = tasks.findIndex((item) => item.id === task.id);
  if (index === -1) return [task, ...tasks];
  const next = [...tasks];
  next[index] = task;
  return next;
};

type Tab = 'board' | 'list' | 'backlog' | 'milestones' | 'settings';
const TABS: [Tab, string][] = [
  ['board', 'Board'],
  ['list', 'List'],
  ['backlog', 'Backlog'],
  ['milestones', 'Milestones'],
  ['settings', 'Settings'],
];

/** One project: its board (live) and settings. */
export const ProjectView = ({ projectKey }: { projectKey: string }) => {
  const router = useRouter();
  const { socket } = useSocket();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('board');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  // Milestones tab -> List tab filtered on that milestone.
  const [milestoneFocus, setMilestoneFocus] = useState('');
  // Subtasks are on the board too; hidden by default to keep it calm.
  const [showSubtasks, setShowSubtasks] = useState(false);
  // Stable object: the dialog reloads its people list when this changes.
  // New tickets are created on the project (any members; nothing in chat).
  const [createTarget, setCreateTarget] = useState<{
    channelId: null;
    conversationId: null;
    projectKey: string;
    backlog?: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await getProject(projectKey);
      // Opened with a former key (renamed project): move to the current one.
      if (result.renamed) {
        router.replace(`/projects/${result.project.key}`);
      }
      setProject(result.project);
      rememberProjectStatuses(result.project);
      const [list, ms] = await Promise.all([
        listProjectTasks(result.project.key),
        listMilestones(result.project.key),
      ]);
      setTasks(list.tasks);
      setMilestones(ms.milestones);
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

  // Live board: join the project room through the shared counter, so a ticket
  // preview or subtask list closing elsewhere never takes the board out of
  // the room. After a dropped connection, rejoin and reload.
  const projectId = project?.id;
  useEffect(() => {
    if (!socket || !projectId) return;
    const release = watchProject(socket, projectId);
    const onReconnect = () => {
      socket.emit('project:join', projectId);
      void load();
    };
    socket.io.on('reconnect', onReconnect);
    return () => {
      release();
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
    return (
      <NotFoundState
        icon="task"
        title={isNotFound(error) ? 'Project not found' : 'Couldn’t load this project'}
        text={
          isNotFound(error)
            ? 'It may have been deleted, or you’re not one of its people. Ask the project lead to add you.'
            : error
        }
        actionLabel="Back to projects"
        actionHref="/projects"
      />
    );
  }
  if (!project) {
    return (
      <div className={`${styles.page} ${styles.centerState}`}>
        <Spinner />
      </div>
    );
  }

  const backlogCount = tasks.filter((task) => task.backlog).length;

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
        {canAdd && tab !== 'settings' && tab !== 'milestones' && (
          <Button
            size="sm"
            onClick={() =>
              setCreateTarget({
                channelId: null,
                conversationId: null,
                projectKey: project.key,
                ...(tab === 'backlog' ? { backlog: true } : {}),
              })
            }
          >
            {tab === 'backlog' ? '+ Add to backlog' : '+ New ticket'}
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
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? styles.tabOn : ''}
            onClick={() => {
              setMilestoneFocus('');
              setTab(value);
            }}
          >
            {label}
            {value === 'backlog' && backlogCount > 0 && (
              <span className={styles.tabCount}>{backlogCount}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'list' || tab === 'backlog' ? (
        <div className={styles.boardArea}>
          <TaskTable
            key={`${tab}-${milestoneFocus}`}
            project={project}
            tasks={tasks.filter((task) => Boolean(task.backlog) === (tab === 'backlog'))}
            milestones={milestones}
            mode={tab}
            initialMilestone={milestoneFocus}
            onChange={(task) => setTasks((current) => upsert(current, task))}
            emptyText={
              tab === 'backlog'
                ? 'The backlog is empty. Tickets moved here stay off the board until you move them back.'
                : 'No tickets on the board yet.'
            }
          />
        </div>
      ) : tab === 'milestones' ? (
        <MilestonesView
          project={project}
          milestones={milestones}
          onChanged={() =>
            void listMilestones(project.key).then((r) => setMilestones(r.milestones))
          }
          onOpen={(milestone) => {
            setMilestoneFocus(milestone.id);
            setTab('list');
          }}
        />
      ) : tab === 'board' ? (
        <div className={styles.boardArea}>
          <label className={styles.boardFilter}>
            <input
              type="checkbox"
              checked={showSubtasks}
              onChange={(event) => setShowSubtasks(event.target.checked)}
            />
            Show subtasks
          </label>
          <KanbanBoard
            tasks={tasks.filter((task) => !task.backlog && (showSubtasks || !task.parentId))}
            statuses={project.statuses}
            onChange={(task) => setTasks((current) => upsert(current, task))}
          />
        </div>
      ) : (
        <ProjectSettings
          project={project}
          onSaved={(next) => {
            setProject(next);
            rememberProjectStatuses(next);
          }}
        />
      )}

      <CreateTaskDialog
        target={createTarget}
        onClose={() => setCreateTarget(null)}
        onCreated={(task) => {
          if (task.projectId === project.id) setTasks((current) => upsert(current, task));
        }}
      />
    </div>
  );
};
