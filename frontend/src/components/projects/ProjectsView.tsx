'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Icon } from '@/components/ui/Icon';
import { useProjects } from '@/hooks/useProjects';
import { useProjectsEnabled } from '@/hooks/useProjectsEnabled';
import { useChannels } from '@/hooks/useChannels';
import { useOrg } from '@/hooks/useOrg';
import { NewProjectDialog } from './NewProjectDialog';
import page from '@/components/saved/SavedView.module.css';
import styles from './Projects.module.css';

/** All projects the viewer can see, with progress. */
export const ProjectsView = () => {
  const enabled = useProjectsEnabled();
  const [archived, setArchived] = useState(false);
  const { projects, loading } = useProjects({ archived });
  const { projects: activeProjects } = useProjects();
  const { channels } = useChannels();
  const { active } = useOrg();
  const [creating, setCreating] = useState(false);
  const canCreate =
    active?.role === 'OWNER' ||
    active?.role === 'ADMIN' ||
    channels.some((channel) => channel.membership?.role === 'MODERATOR');
  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? 'channel';

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
      <header className={`${page.header} ${styles.head}`}>
        <div>
          <span className={page.eyebrow}>Work</span>
          <h1 className={page.title}>Projects</h1>
          <p className={page.subtitle}>
            Tickets, milestones and boards. Each project lives in a home channel.
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
      ) : projects.length === 0 ? (
        <div className={page.emptyCard}>
          <span className={page.emptyIcon} aria-hidden>
            <Icon name="task" size={20} />
          </span>
          <p className={page.emptyTitle}>{archived ? 'No archived projects' : 'No projects yet'}</p>
          <p className={page.empty}>
            {canCreate
              ? 'Create one to track tickets for a team.'
              : 'Admins and channel moderators can create projects.'}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
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
                  {project.homeChannelId
                    ? `# ${channelName(project.homeChannelId)}`
                    : `🔒 Private · ${project.memberIds.length} people`}{' '}
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
