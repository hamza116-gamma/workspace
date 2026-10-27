'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dropdown } from '@/components/ui/Dropdown';
import { useChannels } from '@/hooks/useChannels';
import { useOrg } from '@/hooks/useOrg';
import { listAssignable } from '@/lib/tasks';
import { archiveProject, deleteProject, restoreProject, updateProject } from '@/lib/projects';
import { PROJECT_KEY_PATTERN, type Project } from '@/types/project';
import type { User } from '@/types/user';
import styles from './Projects.module.css';

/** Name, key, lead, linked channels; archive / restore; delete (admins). */
export const ProjectSettings = ({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: (project: Project) => void;
}) => {
  const router = useRouter();
  const { channels } = useChannels();
  const { active } = useOrg();
  const isAdmin = active?.role === 'OWNER' || active?.role === 'ADMIN';
  const [name, setName] = useState(project.name);
  const [key, setKey] = useState(project.key);
  const [leadId, setLeadId] = useState(project.lead.id);
  const [linked, setLinked] = useState(project.linkedChannelIds);
  const [members, setMembers] = useState<User[]>([]);
  const [confirmKey, setConfirmKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const editable = Boolean(project.canManage) && project.status === 'ACTIVE';

  useEffect(() => {
    setName(project.name);
    setKey(project.key);
    setLeadId(project.lead.id);
    setLinked(project.linkedChannelIds);
  }, [project]);

  // Lead candidates = project members (home + linked channels).
  useEffect(() => {
    listAssignable({ channelId: project.homeChannelId, conversationId: null }).then(
      setMembers,
      () => setMembers([]),
    );
  }, [project.homeChannelId, project.linkedChannelIds]);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const keyChanged = key !== project.key;
  const keyValid = PROJECT_KEY_PATTERN.test(key) && key !== 'TASK';

  const save = () =>
    run(
      async () => {
        const { project: next } = await updateProject(project.key, {
          name: name.trim(),
          ...(keyChanged ? { key } : {}),
          leadId,
          linkedChannelIds: linked,
        });
        onSaved(next);
        if (keyChanged) router.replace(`/projects/${next.key}`);
      },
      keyChanged ? `Saved. Old ${project.key}-n links still work.` : 'Saved.',
    );

  const linkOptions = channels
    .filter((c) => c.status === 'ACTIVE' && c.id !== project.homeChannelId && c.isMember)
    .map((c) => ({ value: c.id, label: `# ${c.name}` }));

  return (
    <div className={styles.settings}>
      {!project.canManage && (
        <p className={`${styles.banner} ${styles.span}`}>
          Only the project lead, a moderator or an admin can change these.
        </p>
      )}
      {(error || notice) && (
        <p className={`${error ? styles.error : styles.notice} ${styles.span}`}>
          {error || notice}
        </p>
      )}
      <section className={styles.section}>
        <h3>General</h3>
        <Input
          label="Project name"
          name="settings-name"
          value={name}
          disabled={!editable}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label="Key"
          name="settings-key"
          value={key}
          maxLength={6}
          disabled={!editable}
          error={key && !keyValid ? '2-6 letters or digits, starting with a letter' : undefined}
          onChange={(event) => setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        />
        {keyChanged && keyValid && (
          <p className={styles.hint}>
            Tickets become <b>{key}-n</b>. Links and mentions of <b>{project.key}-n</b> keep
            working.
          </p>
        )}
        <Dropdown
          label="Project lead"
          options={members.map((user) => ({ value: user.id, label: user.fullName }))}
          value={leadId}
          onChange={setLeadId}
          disabled={!editable || members.length === 0}
        />
        <Dropdown
          multiple
          label="Linked channels"
          placeholder="None"
          options={linkOptions}
          value={linked}
          onChange={setLinked}
          disabled={!editable}
        />
        <p className={styles.hint}>
          Members of linked channels are project members too, and see the board there.
        </p>
        {editable && (
          <div className={styles.actions}>
            <Button disabled={busy || !name.trim() || !keyValid} onClick={() => void save()}>
              Save changes
            </Button>
          </div>
        )}
      </section>

      {/* Right column on wide screens: lifecycle actions. */}
      <div className={styles.side}>
        {project.canManage && (
          <section className={styles.section}>
            <h3>{project.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</h3>
            <p className={styles.hint}>
              {project.status === 'ARCHIVED'
                ? 'Make the project active again (its home channel must be free).'
                : 'Archived projects are read-only and hidden from the list. You can restore them.'}
            </p>
            <div className={styles.actions}>
              {project.status === 'ARCHIVED' ? (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      async () => onSaved((await restoreProject(project.key)).project),
                      'Restored.',
                    )
                  }
                >
                  Restore project
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      async () => onSaved((await archiveProject(project.key)).project),
                      'Archived.',
                    )
                  }
                >
                  Archive project
                </Button>
              )}
            </div>
          </section>
        )}

        {isAdmin && (
          <section className={`${styles.section} ${styles.danger}`}>
            <h3>Delete project</h3>
            <p className={styles.hint}>
              Tickets are kept: they go back to their channels as tasks (TASK-n), and {project.key}
              -n links keep working. Type <b>{project.key}</b> to confirm.
            </p>
            <Input
              label="Project key"
              name="confirm-key"
              value={confirmKey}
              onChange={(event) => setConfirmKey(event.target.value.toUpperCase())}
            />
            <div className={styles.actions}>
              <Button
                variant="danger"
                disabled={busy || confirmKey !== project.key}
                onClick={() =>
                  void run(async () => {
                    await deleteProject(project.key, confirmKey);
                    router.push('/projects');
                  }, 'Deleted.')
                }
              >
                Delete project
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
