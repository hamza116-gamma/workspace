import type { Task } from '@/types/task';

export type DueTone = 'later' | 'week' | 'tomorrow' | 'today' | 'late' | 'done';

const formatDay = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Due chip text + tone, shared by the chat card and the Kanban board. */
export const dueChip = (task: Pick<Task, 'dueDate' | 'status'>) => {
  if (!task.dueDate) {
    return null;
  }
  const due = new Date(task.dueDate);
  const days = Math.round(
    (new Date(due.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) /
      86400000,
  );
  if (task.status === 'DONE') {
    return { tone: 'done' as DueTone, text: `Completed · due ${formatDay(due)}` };
  }
  if (days < 0) {
    return {
      tone: 'late' as DueTone,
      text: `Overdue by ${-days} ${days === -1 ? 'day' : 'days'}`,
    };
  }
  if (days === 0) return { tone: 'today' as DueTone, text: 'Due today' };
  if (days === 1) return { tone: 'tomorrow' as DueTone, text: 'Due tomorrow' };
  return { tone: (days <= 7 ? 'week' : 'later') as DueTone, text: `Due ${formatDay(due)}` };
};
