'use client';

import { TaskCard } from './TaskCard';
import { useTicketByKey } from './TicketPreview';
import type { Task } from '@/types/task';
import styles from './Tasks.module.css';

/**
 * A project ticket's card in chat. The message only names the ticket;
 * project members load it (live) and see the full card, everyone else sees
 * that it exists but can't open it.
 */
export const ChatTicketCard = ({
  task: stub,
  canModerate,
  mentionNames,
  onOpen,
}: {
  task: Task;
  canModerate?: boolean;
  mentionNames?: string[];
  onOpen: (task: Task) => void;
}) => {
  const task = useTicketByKey(stub.key);
  if (task) {
    return (
      <TaskCard
        // The chat stub carries the ticket's comment count; keep it.
        task={{ ...task, commentCount: stub.commentCount }}
        canModerate={canModerate}
        mentionNames={mentionNames}
        onOpen={() => onOpen(task)}
      />
    );
  }
  return (
    <span className={styles.lockedTicket}>
      <span>
        🔒 <b className={styles.chipKey}>{stub.key}</b> {stub.title}
      </span>
      <small>{task === null ? 'Only project members can open this ticket' : 'Loading…'}</small>
    </span>
  );
};
