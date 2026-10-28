'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dropdown } from '@/components/ui/Dropdown';
import { useOrg } from '@/hooks/useOrg';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { listAssignable } from '@/lib/tasks';
import { archiveProject, deleteProject, restoreProject, updateProject } from '@/lib/projects';
import { PROJECT_KEY_PATTERN, type Project, type ProjectVisibility } from '@/types/project';
import type { User } from '@/types/user';
import { StatusEditor } from './StatusEditor';
import { SettingsCard } from './SettingsCard';
import styles from './ProjectSettings.module.css';

/** One setting: label and explanation on the left, the control on the right. */
const Row = ({
  label,
  text,
  children,
}: {
  label: string;
  text?: ReactNode;
  children: ReactNode;
}) => (
  <div className={styles.row}>
    <div>
      <p className={styles.rowLabel}>{label}</p>
      {text && <p className={styles.rowText}>{text}</p>}
    </div>
    <div className={styles.control}>{children}</div>
  </div>
);

const VISIBILITY_CHOICES: { value: ProjectVisibility; title: string; text: string }[] = [
  {
    value: 'PUBLIC',
    title: 'Public',
    text: 'Everyone in the workspace, including people who join later.',
  },
  { value: 'PRIVATE', title: '🔒 Private', text: 'Only the people you pick below.' },
];

/** General, access, statuses and the danger zone of one project. */
export const ProjectSettings = ({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: (project: Project) => void;
}) => {
  const router = useRouter();
  const { active } = useOrg();
  const isAdmin = active?.role === 'OWNER' || active?.role === 'ADMIN';
  const [name, setName] = useState(project.name);
  const [key, setKey] = useState(project.key);
  const [leadId, setLeadId] = useState(project.lead.id);
  const [people, setPeople] = useState(project.memberIds);
  const [visibility, setVisibility] = useState(project.visibility);
  const orgPeople = useOrgMembers()
    .filter((member) => member.status === 'ACTIVE')
    .map((member) => ({ value: member.user.id, label: member.user.fullName }));
  const [members, setMembers] = useState<User[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [confirmKey, setConfirmKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const editable = Boolean(project.canManage) && project.status === 'ACTIVE';

  const reset = () => {
    setName(project.name);
    setKey(project.key);
    setLeadId(project.lead.id);
    setPeople(project.memberIds);
    setVisibility(project.visibility);
  };
  useEffect(reset, [project]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lead candidates = current project members.
  useEffect(() => {
    listAssignable({ projectKey: project.key, channelId: null, conversationId: null }).then(
      setMembers,
      () => setMembers([]),
    );
  }, [project]);

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
  const samePeople =
    [...people].sort().join() === [...project.memberIds].sort().join() || visibility === 'PUBLIC';
  const dirty =
    name !== project.name ||
    keyChanged ||
    leadId !== project.lead.id ||
    visibility !== project.visibility ||
    !samePeople;

  const save = () =>
    run(
      async () => {
        const { project: next } = await updateProject(project.key, {
          name: name.trim(),
          ...(keyChanged ? { key } : {}),
          leadId,
          visibility,
          ...(visibility === 'PRIVATE' ? { memberIds: people } : {}),
        });
        onSaved(next);
        if (keyChanged) router.replace(`/projects/${next.key}`);
      },
      keyChanged ? `Saved. Old ${project.key}-n links still work.` : 'Changes saved.',
    );

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        {!project.canManage && (
          <p className={styles.banner}>
            You can view these settings. Only the project lead or a workspace admin can change them.
          </p>
        )}

        <SettingsCard title="General" text="How the project is named and who leads it.">
          <Row label="Project name">
            <Input
              hideLabel
              label="Project name"
              name="settings-name"
              value={name}
              maxLength={80}
              disabled={!editable}
              onChange={(event) => setName(event.target.value)}
            />
          </Row>
          <Row label="Key" text="Prefix of every ticket number.">
            <div className={styles.keyField}>
              <Input
                hideLabel
                label="Key"
                name="settings-key"
                value={key}
                maxLength={6}
                disabled={!editable}
                error={
                  key && !keyValid ? '2-6 letters or digits, starting with a letter' : undefined
                }
                onChange={(event) =>
                  setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                }
              />
              <span className={styles.keyPreview}>{keyValid ? key : 'KEY'}-12</span>
            </div>
            {keyChanged && keyValid && (
              <p className={styles.note}>
                Tickets become <b>{key}-n</b>. Old <b>{project.key}-n</b> links and mentions keep
                working.
              </p>
            )}
          </Row>
          <Row label="Project lead" text="Can change settings and every ticket.">
            <Dropdown
              ariaLabel="Project lead"
              options={members.map((user) => ({ value: user.id, label: user.fullName }))}
              value={leadId}
              onChange={setLeadId}
              disabled={!editable || members.length === 0}
            />
          </Row>
        </SettingsCard>

        <SettingsCard
          title="Access"
          text="Who is in the project. Anyone who loses access is unassigned from its tickets."
        >
          <Row label="Visibility">
            <div className={styles.choices} role="radiogroup" aria-label="Visibility">
              {VISIBILITY_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  role="radio"
                  aria-checked={visibility === choice.value}
                  className={`${styles.choice} ${visibility === choice.value ? styles.choiceOn : ''}`}
                  disabled={!editable}
                  onClick={() => {
                    setVisibility(choice.value);
                    // Going private: start from the lead; pick who else stays.
                    if (choice.value === 'PRIVATE' && people.length === 0) setPeople([leadId]);
                  }}
                >
                  <span className={styles.choiceTitle}>{choice.title}</span>
                  <span className={styles.choiceText}>{choice.text}</span>
                </button>
              ))}
            </div>
          </Row>
          {visibility === 'PRIVATE' && (
            <Row
              label="People"
              text={`${people.length} ${people.length === 1 ? 'person' : 'people'}`}
            >
              <Dropdown
                multiple
                ariaLabel="People"
                placeholder="Pick the people"
                options={orgPeople}
                value={people}
                onChange={setPeople}
                disabled={!editable}
              />
            </Row>
          )}
        </SettingsCard>

        <StatusEditor project={project} onSaved={onSaved} />

        {(project.canManage || isAdmin) && (
          <SettingsCard danger title="Danger zone" text="These affect the whole project.">
            {project.canManage && (
              <div className={styles.dangerRow}>
                <div>
                  <p className={styles.rowLabel}>
                    {project.status === 'ARCHIVED' ? 'Restore project' : 'Archive project'}
                  </p>
                  <p className={styles.rowText}>
                    {project.status === 'ARCHIVED'
                      ? 'Make it active and editable again.'
                      : 'Read-only and hidden from the list. You can restore it later.'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      async () =>
                        onSaved(
                          (project.status === 'ARCHIVED'
                            ? await restoreProject(project.key)
                            : await archiveProject(project.key)
                          ).project,
                        ),
                      project.status === 'ARCHIVED' ? 'Restored.' : 'Archived.',
                    )
                  }
                >
                  {project.status === 'ARCHIVED' ? 'Restore' : 'Archive'}
                </Button>
              </div>
            )}
            {isAdmin && (
              <>
                <div className={styles.dangerRow}>
                  <div>
                    <p className={styles.rowLabel}>Delete project</p>
                    <p className={styles.rowText}>
                      Permanent. Old channel tasks go back to their chat as TASK-n; chat messages
                      stay.
                    </p>
                  </div>
                  {!confirming && (
                    <Button variant="danger" onClick={() => setConfirming(true)}>
                      Delete…
                    </Button>
                  )}
                </div>
                {confirming && (
                  <div className={styles.confirm}>
                    {(project.channelFreeTickets ?? 0) > 0 && (
                      <p className={styles.warn}>
                        {project.channelFreeTickets}{' '}
                        {project.channelFreeTickets === 1 ? 'ticket has' : 'tickets have'} no chat
                        to go back to and will be deleted too.
                      </p>
                    )}
                    <p className={styles.note}>
                      Type <b>{project.key}</b> to confirm.
                    </p>
                    <div className={styles.confirmRow}>
                      <Input
                        hideLabel
                        label="Project key"
                        name="confirm-key"
                        value={confirmKey}
                        autoFocus
                        onChange={(event) => setConfirmKey(event.target.value.toUpperCase())}
                      />
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setConfirming(false);
                          setConfirmKey('');
                        }}
                      >
                        Cancel
                      </Button>
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
                  </div>
                )}
              </>
            )}
          </SettingsCard>
        )}
      </div>

      {/* Appears for unsaved General / Access changes, and for their result. */}
      {((editable && dirty) || error || notice) && (
        <div className={styles.saveBar} role="status">
          <span className={styles.saveText}>
            {error ? (
              <span className={styles.fail}>{error}</span>
            ) : dirty ? (
              'You have unsaved changes.'
            ) : (
              <span className={styles.ok}>{notice}</span>
            )}
          </span>
          {editable && dirty ? (
            <>
              <Button variant="secondary" disabled={busy} onClick={reset}>
                Discard
              </Button>
              <Button disabled={busy || !name.trim() || !keyValid} onClick={() => void save()}>
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setError('');
                setNotice('');
              }}
            >
              Dismiss
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
