import type { User } from './user';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type Task = {
  id: string;
  key: string;
  number: number;
  channelId: string | null;
  conversationId: string | null;
  messageId: string;
  title: string;
  description: string;
  status: TaskStatus;
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
};

export type TaskInput = {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignees?: string[];
  dueDate?: string | null;
  labels?: string[];
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: '#98a2b3',
  IN_PROGRESS: '#2e90fa',
  IN_REVIEW: '#f79009',
  DONE: '#12b76a',
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: '#98a2b3',
  MEDIUM: '#2e90fa',
  HIGH: '#f79009',
  URGENT: '#f04438',
};
