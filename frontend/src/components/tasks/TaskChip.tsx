'use client';

import { useState } from 'react';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS, type Task } from '@/types/task';
import styles from './Tasks.module.css';

/**
 * The quiet link from a chat message to its ticket: "→ WEB-12 · In progress
 * · Ali". One line; the ticket's details and discussion open in the panel.
 * Status / assignees update live.
 */
export const TaskChip = ({ task: initial, onOpen }: { task: Task; onOpen: () => void }) => {
  const [task, setTask] = useState(initial);
  const [seen, setSeen] = useState(initial.updatedAt);
  if (initial.updatedAt !== seen) {
    setSeen(initial.updatedAt);
    setTask(initial);
  }
  useTaskEvents((next, deleted) => {
    if (next.id === task.id && !deleted) setTask(next);
  });

  const who = task.assignees.map((user) => user.fullName).join(', ');
  return (
    <button type="button" className={styles.chip} onClick={onOpen} title={`Open ${task.key}`}>
      <span aria-hidden>→</span>
      <b className={styles.chipKey}>{task.key}</b>
      <span className={styles.chipStatus} style={{ color: TASK_STATUS_COLORS[task.status] }}>
        <i style={{ background: TASK_STATUS_COLORS[task.status] }} />
        {TASK_STATUS_LABELS[task.status]}
      </span>
      {who && <span className={styles.chipWho}>· {who}</span>}
    </button>
  );
};
