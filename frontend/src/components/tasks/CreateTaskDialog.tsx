'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dropdown } from '@/components/ui/Dropdown';
import { createTaskFromMessage, createTaskInChat, listAssignable } from '@/lib/tasks';
import { tokensToDisplay } from '@/lib/mentions';
import { MentionInput } from './MentionText';
import { LabelInput } from './LabelInput';
import { TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS, type TaskPriority } from '@/types/task';
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

/** Turns a message into a task. The card updates live from the socket. */
export const CreateTaskDialog = ({
  message = null,
  target = null,
  onClose,
}: {
  // Turn this message into a task...
  message?: Message | null;
  // ...or post a brand-new task card in this chat (Tasks tab, /task).
  target?: { channelId: string | null; conversationId: string | null; title?: string } | null;
  onClose: () => void;
}) => {
  const open = Boolean(message || target);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [people, setPeople] = useState<User[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!message && !target) {
      return;
    }
    if (!message && target) {
      setTitle(target.title ?? '');
      setDescription('');
      setLabels([]);
      setPriority('MEDIUM');
      setDueDate('');
      setError('');
      setAssignees([]);
      setPeople(null);
      let alive = true;
      listAssignable(target).then(
        (users) => alive && setPeople(users),
        () => alive && setPeople([]),
      );
      return () => {
        alive = false;
      };
    }
    if (!message) {
      return;
    }
    const readable = tokensToDisplay(message.content, message.mentions);
    setTitle(firstLine(readable));
    setDescription(restOfMessage(readable).slice(0, DESCRIPTION_MAX));
    setLabels([]);
    setPriority('MEDIUM');
    setDueDate('');
    setError('');
    setPeople(null);
    // People mentioned in the message are pre-selected as assignees.
    const mentioned = message.mentions.map((user) => user.id);
    setAssignees([]);
    let alive = true;
    listAssignable({ channelId: message.channelId, conversationId: message.conversationId }).then(
      (users) => {
        if (!alive) {
          return;
        }
        setPeople(users);
        const inChat = new Set(users.map((user) => user.id));
        setAssignees(mentioned.filter((id) => inChat.has(id)));
      },
      () => alive && setPeople([]),
    );
    return () => {
      alive = false;
    };
  }, [message, target]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message && !target) {
      return;
    }
    if (!title.trim()) {
      setError('Task title is required');
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
        assignees,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:00`).toISOString() : null,
      };
      if (message) {
        await createTaskFromMessage(message.id, fields);
      } else if (target) {
        await createTaskInChat(target, fields);
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
        <div className={styles.row}>
          <Dropdown
            label="Priority"
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={setPriority}
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
