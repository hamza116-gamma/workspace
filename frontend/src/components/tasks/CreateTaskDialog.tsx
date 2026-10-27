'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dropdown } from '@/components/ui/Dropdown';
import { createTaskFromMessage, createTaskInChat, listAssignable } from '@/lib/tasks';
import { tokensToDisplay } from '@/lib/mentions';
import { useProjects } from '@/hooks/useProjects';
import { createProjectTask } from '@/lib/projects';
import { useProjectsEnabled } from '@/hooks/useProjectsEnabled';
import { useChannels } from '@/hooks/useChannels';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import { MentionInput } from './MentionText';
import { LabelInput } from './LabelInput';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  firstOfGroup,
  type TaskPriority,
} from '@/types/task';
import {
  TASK_TYPE_ICONS,
  TASK_TYPE_LABELS,
  type TaskType,
} from '@/types/task';
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
    title?: string;
  } | null;
  onClose: () => void;
}) => {
  const open = Boolean(message || target);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  // "More details": type and estimate (collapsed by default).
  const [showMore, setShowMore] = useState(false);
  const [type, setType] = useState<TaskType>('TASK');
  const [estimate, setEstimate] = useState('');
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
    setShowMore(false);
    setType('TASK');
    setEstimate('');
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
        ? Promise.all([
            projectPeople(),
            listAssignable({ channelId, conversationId: null }),
          ]).then(([inProject, inChannel]) => {
            const there = new Set(inChannel.map((user) => user.id));
            return inProject.filter((user) => there.has(user.id));
          })
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
      if (message) {
        await createTaskFromMessage(message.id, withProject);
      } else if (target?.projectKey) {
        await createProjectTask(target.projectKey, {
          ...fields,
          ...(channelId ? { channelId } : {}),
        });
      } else if (target?.pickChannel && chosenProject) {
        // A project picked on the Unassigned board: it goes on that board.
        await createProjectTask(chosenProject.key, {
          ...fields,
          ...(channelId ? { channelId } : {}),
        });
      } else if (target?.pickChannel) {
        await createTaskInChat({ channelId, conversationId: null }, fields);
      } else if (target) {
        await createTaskInChat(target, withProject);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Create task" onClose={onClose}>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
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
        {/* Project first: the status list below follows it. */}
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
        <div className={styles.row}>
          <Dropdown
            label="Priority"
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={setPriority}
          />
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
          <Input
            label="Due date"
            name="task-due"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>
        <LabelInput value={labels} onChange={setLabels} />
        <button
          type="button"
          className={styles.moreToggle}
          aria-expanded={showMore}
          onClick={() => setShowMore((open) => !open)}
        >
          {showMore ? '▾' : '▸'} More details
          {!showMore && (type !== 'TASK' || estimate) && (
            <span className={styles.moreSummary}>
              {TASK_TYPE_LABELS[type]}
              {estimate ? ` · ${estimate}` : ''}
            </span>
          )}
        </button>
        {showMore && (
          <div className={styles.row}>
            <Dropdown label="Type" options={TYPE_OPTIONS} value={type} onChange={setType} />
            <Input
              label="Estimate"
              name="task-estimate"
              placeholder="e.g. 30m, 2h, 1.5d"
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
            />
          </div>
        )}
        <Dropdown
          multiple
          label="Assignees"
          placeholder={people === null ? 'Loading people…' : 'Unassigned'}
          disabled={people === null}
          options={(people ?? []).map((user) => ({ value: user.id, label: user.fullName }))}
          value={assignees}
          onChange={setAssignees}
        />
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
