import type { NotificationItem } from '@/types/notification';

export type ActivityFilter = 'ALL' | 'MENTIONS' | 'THREADS' | 'TASKS' | 'REACTIONS';

export const FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'MENTIONS', label: 'Mentions' },
  { id: 'THREADS', label: 'Threads' },
  { id: 'TASKS', label: 'Tasks' },
  { id: 'REACTIONS', label: 'Reactions' },
];

// Reactions are not stored as notifications yet, so that filter stays
// empty until the backend emits a REACTION type.
const TYPES: Record<Exclude<ActivityFilter, 'ALL'>, string[]> = {
  MENTIONS: ['MENTION'],
  THREADS: ['THREAD_REPLY'],
  TASKS: ['TASK_ASSIGNED', 'TASK_DUE'],
  REACTIONS: ['REACTION'],
};

export const applyFilter = (items: NotificationItem[], filter: ActivityFilter) =>
  filter === 'ALL' ? items : items.filter((item) => TYPES[filter].includes(item.type));
