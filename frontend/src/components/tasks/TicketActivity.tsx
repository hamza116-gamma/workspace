'use client';

import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import { listTaskFollowers, listTaskHistory, type TaskHistoryEvent } from '@/lib/tasks';
import type { Task } from '@/types/task';
import type { User } from '@/types/user';
import styles from './Tasks.module.css';

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  type: 'type',
  estimate: 'estimate',
  dueDate: 'due date',
  labels: 'labels',
  assignees: 'assignees',
  project: 'project',
  subtask: 'subtask',
};

const time = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

// "changed status: To do → In review"
const describe = (event: TaskHistoryEvent) => {
  if (event.kind === 'created') return ['created this task'];
  if (event.kind === 'subtask') return event.changes.map((c) => `added subtask ${c.to}`);
  if (event.kind === 'moved') return event.changes.map((c) => `moved it: ${c.from} → ${c.to}`);
  return event.changes.map((change) => {
    const field = FIELD_LABELS[change.field] ?? change.field;
    if (change.field === 'description') return 'updated the description';
    if (!change.from) return `set ${field} to ${change.to}`;
    if (!change.to) return `cleared ${field} (was ${change.from})`;
    return `changed ${field}: ${change.from} → ${change.to}`;
  });
};

/**
 * Who follows the ticket (they hear about its comments) with a follow
 * toggle, and its history: every change, who made it and when.
 */
export const TicketActivity = ({
  task,
  following,
  onToggleFollow,
}: {
  task: Task;
  following: boolean;
  onToggleFollow: () => void;
}) => {
  const [followers, setFollowers] = useState<User[]>([]);
  const [events, setEvents] = useState<TaskHistoryEvent[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadFollowers = useCallback(() => {
    listTaskFollowers(task.id).then(
      (result) => setFollowers(result.followers),
      () => setFollowers([]),
    );
  }, [task.id]);
  const loadHistory = useCallback(() => {
    listTaskHistory(task.id).then(
      (result) => setEvents(result.events),
      () => setEvents([]),
    );
  }, [task.id]);

  // Followers change with the bell; history with every edit of this task.
  useEffect(loadFollowers, [loadFollowers, following]);
  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);
  useTaskEvents((next) => {
    if (next.id !== task.id) return;
    loadFollowers();
    if (showHistory) loadHistory();
  });

  return (
    <section className={styles.activity} aria-label="Followers and history">
      <div className={styles.followRow}>
        <span className={styles.followAvatars}>
          {followers.slice(0, 5).map((user) => (
            <span key={user.id} className={styles.followAvatar} title={user.fullName}>
              <Avatar name={user.fullName} src={user.avatarUrl} size={22} />
            </span>
          ))}
        </span>
        <span className={styles.followText}>
          {followers.length ? `${followers.length} following` : 'Nobody follows this yet'}
        </span>
        <button
          type="button"
          className={`${styles.followButton} ${following ? styles.followOn : ''}`}
          aria-pressed={following}
          onClick={onToggleFollow}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      </div>

      <button
        type="button"
        className={styles.historyToggle}
        aria-expanded={showHistory}
        onClick={() => setShowHistory((open) => !open)}
      >
        {showHistory ? '▾' : '▸'} History
      </button>
      {showHistory && (
        <ol className={styles.history}>
          {events === null && <li className={styles.muted}>Loading…</li>}
          {events?.length === 0 && <li className={styles.muted}>No changes yet.</li>}
          {events?.map((event) => (
            <li key={event.id} className={styles.historyItem}>
              <Avatar name={event.actor.fullName ?? '?'} src={event.actor.avatarUrl} size={20} />
              <div>
                {describe(event).map((line) => (
                  <p key={line} className={styles.historyLine}>
                    <b>{event.actor.fullName ?? 'Someone'}</b> {line}
                  </p>
                ))}
                <time className={styles.historyTime} dateTime={event.createdAt}>
                  {time(event.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
