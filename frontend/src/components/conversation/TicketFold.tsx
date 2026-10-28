'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTaskStatuses } from '@/hooks/useTaskStatuses';
import type { Task } from '@/types/task';
import styles from './ThreadPanel.module.css';

// Short windows: the ticket card and subtasks fold into one bar, so the
// comments get the room. Tall windows show them as before.
const SHORT_SCREEN = '(max-height: 820px)';

const useShortScreen = () => {
  const [short, setShort] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(SHORT_SCREEN);
    const update = () => setShort(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return short;
};

/**
 * The top of a task's thread panel (card, subtasks...). On short screens it
 * is a one-line bar - key, title, status, subtask count - that opens it.
 */
export const TicketFold = ({
  task,
  label,
  children,
}: {
  task: Task;
  // Bar text instead of the title (e.g. a chat task whose card is the root).
  label?: string;
  children: ReactNode;
}) => {
  const short = useShortScreen();
  const [open, setOpen] = useState(false);
  const { statusOf } = useTaskStatuses();

  if (!short) {
    return <div className={styles.ticketHead}>{children}</div>;
  }
  const status = statusOf(task);
  return (
    <div className={styles.foldWrap}>
      <button
        type="button"
        className={styles.foldBar}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.foldKey}>{task.key}</span>
        <span className={styles.foldTitle}>{label ?? task.title}</span>
        <span className={styles.foldStatus} style={{ color: status.color }}>
          <i style={{ background: status.color }} />
          {status.name}
        </span>
        {task.subtaskTotal > 0 && (
          <span className={styles.foldCount}>
            {task.subtaskDone} / {task.subtaskTotal}
          </span>
        )}
        <span className={styles.foldChevron} aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && <div className={styles.ticketHead}>{children}</div>}
    </div>
  );
};
