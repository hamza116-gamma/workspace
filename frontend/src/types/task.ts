import type { User } from './user';

// Key of one of the task's project statuses (or a default one for chat tasks).
export type TaskStatus = string;
// Every status is in one group; the group decides "done" / "open".
export type StatusGroup = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskStatusDef = { key: string; name: string; color: string; group: StatusGroup };

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

// Chat tasks (Unassigned) and a new project's starting set; same as the server.
export const DEFAULT_STATUSES: TaskStatusDef[] = [
  { key: 'TODO', name: 'To do', color: '#8a94a6', group: 'TODO' },
  { key: 'IN_PROGRESS', name: 'In progress', color: '#3b82f6', group: 'IN_PROGRESS' },
  { key: 'IN_REVIEW', name: 'In review', color: '#f59e0b', group: 'IN_PROGRESS' },
  { key: 'DONE', name: 'Done', color: '#22a06b', group: 'DONE' },
];
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type Task = {
  id: string;
  key: string;
  number: number;
  // null for chat tasks (TASK-n).
  projectId?: string | null;
  projectKey?: string;
  channelId: string | null;
  conversationId: string | null;
  messageId: string;
  // Chat message this ticket was made from (it shows a chip).
  sourceMessageId?: string | null;
  // Author of that message.
  reporter?: User | null;
  title: string;
  description: string;
  status: TaskStatus;
  statusGroup: StatusGroup;
  priority: TaskPriority;
  assignees: User[];
  dueDate: string | null;
  labels: string[];
  // Board order inside a status column (ascending).
  position: number;
  createdBy: User;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Project ticket seen in chat: only id/key/title come with the message;
  // members load the rest by key.
  locked?: boolean;
};

export type TaskInput = {
  // Project for a ticket made from a message ('' = no project).
  projectId?: string;
  // New ticket on a project board: also post its card in this channel.
  channelId?: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignees?: string[];
  dueDate?: string | null;
  labels?: string[];
};


export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};


export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: '#98a2b3',
  MEDIUM: '#2e90fa',
  HIGH: '#f79009',
  URGENT: '#f04438',
};

/** First status of a group in a list (where a moved / new task lands). */
export const firstOfGroup = (statuses: TaskStatusDef[], group: StatusGroup) =>
  statuses.find((status) => status.group === group) ?? statuses[0];
