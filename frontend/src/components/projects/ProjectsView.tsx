'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { useProjects } from '@/hooks/useProjects';
import { useProjectsEnabled } from '@/hooks/useProjectsEnabled';
import { useOrg } from '@/hooks/useOrg';
import { NewProjectDialog } from './NewProjectDialog';
import { peopleLabel, UNASSIGNED_KEY } from '@/types/project';
import page from '@/components/saved/SavedView.module.css';
import styles from './Projects.module.css';

/** All projects the viewer can see, with progress. */
export const ProjectsView = () => {
  const enabled = useProjectsEnabled();
  const [archived, setArchived] = useState(false);
  const { projects, loading } = useProjects({ archived });
  const { projects: activeProjects } = useProjects();
  const { active } = useOrg();
  const [creating, setCreating] = useState(false);
  // Anyone in the workspace can start a project (they become its lead).
  const canCreate = Boolean(active);

  if (!enabled) {
    return (
      <div className={page.page}>
        <div className={page.emptyCard}>
          <p className={page.emptyTitle}>Projects is off for this workspace</p>
          <p className={page.empty}>A workspace admin can turn it on in Settings → General.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={page.page}>
      <header className={styles.head}>
        <div>
          <span className={page.eyebrow}>Work</span>
          <h1 className={page.title}>Projects</h1>
          <p className={page.subtitle}>
            Tickets, milestones and boards. Only a project&apos;s people can see it.
          </p>
        </div>
        {canCreate && <Button onClick={() => setCreating(true)}>+ New project</Button>}
      </header>

      <div className={styles.segment}>
        <button
          type="button"
          className={!archived ? styles.on : ''}
          onClick={() => setArchived(false)}
        >
          Active
        </button>
        <button
          type="button"
          className={archived ? styles.on : ''}
          onClick={() => setArchived(true)}
        >
          Archived
        </button>
      </div>

      {loading ? (
        <div className={page.center}>
          <Spinner />
        </div>
      ) : archived && projects.length === 0 ? (
        <div className={page.emptyCard}>
          <span className={page.emptyIcon} aria-hidden>
            <Icon name="task" size={20} />
          </span>
          <p className={page.emptyTitle}>No archived projects</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {/* Built-in board: tasks that are in no project. */}
          {!archived && (
            <Link href={`/projects/${UNASSIGNED_KEY}`} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.key}>{UNASSIGNED_KEY}</span>
                <b className={styles.name}>Unassigned</b>
              </div>
              <p className={styles.meta}>Tasks from your chats that are in no project</p>
            </Link>
          )}
          {projects.map((project) => {
            const total = project.counts?.total ?? 0;
            const done = project.counts?.done ?? 0;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <Link key={project.id} href={`/projects/${project.key}`} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.key}>{project.key}</span>
                  <b className={styles.name}>{project.name}</b>
                </div>
                <p className={styles.meta}>
                  {peopleLabel(project)}{' '}
                  · {total} {total === 1 ? 'ticket' : 'tickets'} · lead {project.lead.fullName}
                </p>
                <div className={styles.bar}>
                  <i style={{ width: `${pct}%` }} />
                </div>
                <span className={styles.meta}>{pct}% done</span>
              </Link>
            );
          })}
        </div>
      )}

      <NewProjectDialog
        open={creating}
        projects={activeProjects}
        onClose={() => setCreating(false)}
      />
    </div>
  );
};
