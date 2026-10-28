'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dropdown } from '@/components/ui/Dropdown';
import {
  createSubtask,
  createTaskFromMessage,
  createTaskInChat,
  listAssignable,
} from '@/lib/tasks';
import { tokensToDisplay } from '@/lib/mentions';
import { useProjects } from '@/hooks/useProjects';
import { createProjectTask } from '@/lib/projects';
import { useProjectsEnabled } from '@/hooks/useProjectsEnabled';
import { useChannels } from '@/hooks/useChannels';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { MentionInput } from './MentionText';
import { LabelInput } from './LabelInput';
import { TaskSteps, type TaskStep } from './TaskSteps';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  firstOfGroup,
  type TaskPriority,
} from '@/types/task';
import { TASK_TYPE_ICONS, TASK_TYPE_LABELS, type TaskType } from '@/types/task';
import type { Task } from '@/types/task';
import type { Message } from '@/types/message';
import type { User } from '@/types/user';
import styles from './Tasks.module.css';

const PRIORITY_OPTIONS = (Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((value) => ({
  value,
  label: TASK_PRIORITY_LABELS[value],
  color: TASK_PRIORITY_COLORS[value],
}));

const firstLine = (content: string) =>
  content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 200) ?? '';

// Everything after the first non-empty line (it became the title).
const restOfMessage = (content: string) => {
  const lines = content.split('\n');
  const first = lines.findIndex((line) => line.trim());
  return first === -1
    ? ''
    : lines
        .slice(first + 1)
        .join('\n')
        .trim();
};

const DESCRIPTION_MAX = 4000;

const TYPE_OPTIONS = (Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((value) => ({
  value,
  label: `${TASK_TYPE_ICONS[value]}  ${TASK_TYPE_LABELS[value]}`,
}));

/** Turns a message into a task. The card updates live from the socket. */
export const CreateTaskDialog = ({
  message = null,
  target = null,
  onClose,
  onCreated,
}: {
  // Turn this message into a task...
  message?: Message | null;
  // ...or post a brand-new task card in this chat (Tasks tab, /task).
  // projectKey: create on that project's board (optionally also posted in a
  // channel). pickChannel: the user picks the channel (Unassigned board).
  target?: {
    channelId: string | null;
    conversationId: string | null;
    projectKey?: string;
    pickChannel?: boolean;
    // Project board's Backlog tab: the ticket starts in the backlog.
    backlog?: boolean;
    title?: string;
  } | null;
  onClose: () => void;
  // The new task, as soon as it exists (boards add it without waiting for
  // the live update).
  onCreated?: (task: Task) => void;
}) => {
  const open = Boolean(message || target);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [type, setType] = useState<TaskType>('TASK');
  const [estimate, setEstimate] = useState('');
  // Three steps (Basics, Details, Subtasks); creating works from any step.
  const [step, setStep] = useState<TaskStep>(0);
  // Subtask titles typed in step 3, created right after the task.
  const [drafts, setDrafts] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  // The task exists but some subtasks failed: only "Close" is left (no re-create).
  const [createdWithErrors, setCreatedWithErrors] = useState(false);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [people, setPeople] = useState<User[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Project for a task made in chat ('' = no project, a plain chat task).
  // Only projects the user is in; not offered on a project's own board.
  const projectsEnabled = useProjectsEnabled();
  const { projects } = useProjects();
  const memberProjects = projects.filter((p) => p.isMember && !p.readOnly);
  const [projectId, setProjectId] = useState('');
  const pickProject = projectsEnabled && !target?.projectKey && memberProjects.length > 0;
  const chosenProject = memberProjects.find((p) => p.id === projectId);
  // Status list of where the task goes: the picked project, the board's
  // project, or the defaults (Unassigned). '' = its first "to do" status.
  const { statusesFor } = useTaskStatuses();
  const boardProject = target?.projectKey
    ? projects.find((p) => p.key === target.projectKey)
    : undefined;
  const statusList = statusesFor(chosenProject?.id ?? boardProject?.id ?? null);
  const [statusKey, setStatusKey] = useState('');
  const statusValue = statusList.some((item) => item.key === statusKey)
    ? statusKey
    : firstOfGroup(statusList, 'TODO').key;
  // Channel to post the card in: optional on a project board, required on
  // the Unassigned board (a task without a project lives in a chat).
  const { channels } = useChannels();
  const channelOptions = channels
    .filter((c) => c.isMember && c.status === 'ACTIVE')
    .map((c) => ({ value: c.id, label: `${c.type === 'PRIVATE' ? '🔒 ' : '# '}${c.name}` }));
  const showChannel = Boolean(target?.projectKey || target?.pickChannel);
  const [channelId, setChannelId] = useState('');

  useEffect(() => {
    if (!message && !target) {
      return;
    }
    setLabels([]);
    setPriority('MEDIUM');
    setDueDate('');
    setType('TASK');
    setEstimate('');
    setStep(0);
    setDrafts([]);
    setDraft('');
    setCreatedWithErrors(false);
    setError('');
    setProjectId('');
    setChannelId('');
    setStatusKey('');
    setAssignees([]);
    if (message) {
      const readable = tokensToDisplay(message.content, message.mentions);
      setTitle(firstLine(readable));
      setDescription(restOfMessage(readable).slice(0, DESCRIPTION_MAX));
    } else if (target) {
      setTitle(target.title ?? '');
      setDescription('');
    }
  }, [message, target]);

  // The people list follows the chosen project (its members) or the chat,
  // without resetting what the user already typed.
  const chosenKey = chosenProject?.key ?? target?.projectKey ?? '';
  useEffect(() => {
    const chat = message ?? (target?.pickChannel ? { channelId, conversationId: null } : target);
    if (!chat) {
      return;
    }
    if (!chosenKey && !chat.channelId && !chat.conversationId) {
      // Unassigned board before a channel is picked: nobody to offer yet.
      setPeople([]);
      return;
    }
    setPeople(null);
    // People mentioned in the message are pre-selected as assignees.
    const wanted = message ? message.mentions.map((user) => user.id) : [];
    let alive = true;
    // A project ticket also posted in a channel: only people in both the
    // project and that channel. "Only on the board": all project members.
    const projectPeople = () =>
      listAssignable({ projectKey: chosenKey, channelId: null, conversationId: null });
    const load = !chosenKey
      ? listAssignable({ channelId: chat.channelId, conversationId: chat.conversationId })
      : channelId
        ? Promise.all([projectPeople(), listAssignable({ channelId, conversationId: null })]).then(
            ([inProject, inChannel]) => {
              const there = new Set(inChannel.map((user) => user.id));
              return inProject.filter((user) => there.has(user.id));
            },
          )
        : projectPeople();
    load.then(
      (users) => {
        if (!alive) {
          return;
        }
        setPeople(users);
        const allowed = new Set(users.map((user) => user.id));
        setAssignees((current) =>
          [...new Set([...current, ...wanted])].filter((id) => allowed.has(id)),
        );
      },
      () => alive && setPeople([]),
    );
    return () => {
      alive = false;
    };
  }, [message, target, chosenKey, channelId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message && !target) {
      return;
    }
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }
    if (target?.pickChannel && !chosenProject && !channelId) {
      setError('Pick a channel for the task, or a project');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const fields = {
        title: title.trim(),
        description: description.trim(),
        labels,
        priority,
        status: statusValue,
        assignees,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:00`).toISOString() : null,
        type,
        estimate: estimate.trim(),
      };
      const withProject = chosenProject ? { ...fields, projectId: chosenProject.id } : fields;
      let created: { task: Task } | null = null;
      if (message) {
        created = await createTaskFromMessage(message.id, withProject);
      } else if (target?.projectKey) {
        created = await createProjectTask(target.projectKey, {
          ...fields,
          ...(channelId ? { channelId } : {}),
          ...(target.backlog ? { backlog: true } : {}),
        });
      } else if (target?.pickChannel && chosenProject) {
        // A project picked on the Unassigned board: it goes on that board.
        created = await createProjectTask(chosenProject.key, {
          ...fields,
          ...(channelId ? { channelId } : {}),
        });
      } else if (target?.pickChannel) {
        created = await createTaskInChat({ channelId, conversationId: null }, fields);
      } else if (target) {
        created = await createTaskInChat(target, withProject);
      }
      if (created) onCreated?.(created.task);
      // Subtasks from step 3 (a pending title in the box counts too).
      const titles = [...drafts, draft.trim()].filter(Boolean);
      if (created && titles.length) {
        const parentId = created.task.id;
        const failed: string[] = [];
        for (const subtaskTitle of titles) {
          await createSubtask(parentId, { title: subtaskTitle }).catch(() =>
            failed.push(subtaskTitle),
          );
        }
        if (failed.length) {
          setError(`Task created, but these subtasks failed: ${failed.join(', ')}`);
          setCreatedWithErrors(true);
          return;
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the task');
    } finally {
      setSaving(false);
    }
  };

  const titleOk = Boolean(title.trim());
  const addDraft = () => {
    const text = draft.trim();
    if (text && drafts.length < 20) {
      setDrafts((current) => [...current, text.slice(0, 200)]);
      setDraft('');
    }
  };
  const hints = [
    chosenProject ? chosenProject.key : target?.projectKey,
    [
      statusList.find((item) => item.key === statusValue)?.name,
      assignees.length ? `${assignees.length} assigned` : undefined,
    ]
      .filter(Boolean)
      .join(' · '),
    drafts.length ? `${drafts.length} added` : 'Optional',
  ];

  return (
    <Modal open={open} title="Create task" onClose={onClose}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          // Enter moves on; creating is the last step's (or the button's) job.
          if (step < 2 && titleOk) setStep((step + 1) as TaskStep);
          else void submit(event);
        }}
      >
        <TaskSteps step={step} onStep={setStep} canJump={titleOk} hints={hints} />

        {step === 0 && (
          <>
            <MentionInput
              label="Title"
              name="task-title"
              value={title}
              names={message?.mentions.map((user) => user.fullName) ?? []}
              maxLength={200}
              autoFocus
              onChange={setTitle}
            />
            <div className={styles.mentionField}>
              <label htmlFor="task-description" className={styles.mentionLabel}>
                Description <span className={styles.optional}>(optional)</span>
              </label>
              <textarea
                id="task-description"
                className={styles.textarea}
                rows={4}
                maxLength={DESCRIPTION_MAX}
                placeholder="Add details, steps, links…"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            {/* Project first: the status list in the next step follows it. */}
            {pickProject && (
              <Dropdown
                label="Project"
                options={[
                  { value: '', label: 'Unassigned' },
                  ...memberProjects.map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` })),
                ]}
                value={projectId}
                onChange={setProjectId}
              />
            )}
            {showChannel && (
              <Dropdown
                label={
                  target?.pickChannel && !chosenProject ? 'Channel' : 'Post in channel (optional)'
                }
                placeholder={
                  target?.pickChannel && !chosenProject ? 'Pick a channel' : 'Only on the board'
                }
                options={[
                  ...(target?.pickChannel && !chosenProject
                    ? []
                    : [{ value: '', label: 'Only on the board' }]),
                  ...channelOptions,
                ]}
                value={channelId}
                onChange={setChannelId}
              />
            )}
            {chosenProject && !target?.pickChannel && (
              <p className={styles.muted}>
                Goes on the {chosenProject.key} board. People here who aren&apos;t in{' '}
                {chosenProject.name} see the card but can&apos;t open it.
              </p>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <div className={styles.row}>
              <Dropdown
                label="Status"
                options={statusList.map((item) => ({
                  value: item.key,
                  label: item.name,
                  color: item.color,
                }))}
                value={statusValue}
                onChange={setStatusKey}
              />
              <Dropdown
                label="Priority"
                options={PRIORITY_OPTIONS}
                value={priority}
                onChange={setPriority}
              />
            </div>
            <Dropdown
              multiple
              label="Assignees"
              placeholder={people === null ? 'Loading people…' : 'Unassigned'}
              disabled={people === null}
              options={(people ?? []).map((user) => ({ value: user.id, label: user.fullName }))}
              value={assignees}
              onChange={setAssignees}
            />
            <div className={styles.row}>
              <Input
                label="Due date"
                name="task-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
              <Input
                label="Estimate"
                name="task-estimate"
                placeholder="e.g. 30m, 2h, 1.5d"
                value={estimate}
                onChange={(event) => setEstimate(event.target.value)}
              />
            </div>
            <Dropdown label="Type" options={TYPE_OPTIONS} value={type} onChange={setType} />
            <LabelInput value={labels} onChange={setLabels} />
          </>
        )}

        {step === 2 && (
          <>
            <p className={styles.muted}>
              Optional. Each subtask becomes its own task (own key, status and assignee), created
              right after this one. You can also add them later from the task.
            </p>
            {drafts.length > 0 && (
              <ul className={styles.draftList}>
                {drafts.map((item, index) => (
                  <li key={`${item}-${index}`} className={styles.draftRow}>
                    <span>{item}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${item}`}
                      onClick={() =>
                        setDrafts((current) => current.filter((_, at) => at !== index))
                      }
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              className={styles.subtaskInput}
              placeholder="Type a subtask and press Enter"
              value={draft}
              maxLength={200}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addDraft();
                }
              }}
            />
          </>
        )}

        {error && <p className={styles.error}>{error}</p>}
        <div className={`${styles.stepActions} ${styles.stickyFoot}`}>
          {step > 0 ? (
            <Button
              variant="secondary"
              type="button"
              onClick={() => setStep((step - 1) as TaskStep)}
            >
              Back
            </Button>
          ) : (
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
          )}
          <span className={styles.grow} />
          {step < 2 && !createdWithErrors && (
            <Button
              type="button"
              disabled={!titleOk}
              onClick={() => setStep((step + 1) as TaskStep)}
            >
              Next
            </Button>
          )}
          {createdWithErrors ? (
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          ) : step < 2 ? null : (
            <Button
              type="button"
              disabled={saving || !titleOk}
              onClick={(event) => void submit(event)}
            >
              {saving ? 'Creating…' : 'Create task'}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
};
