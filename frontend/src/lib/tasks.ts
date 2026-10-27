import { apiData } from './api';
import type { Task, TaskInput } from '@/types/task';
import type { Message, PendingAttachment } from '@/types/message';
import type { User } from '@/types/user';

export const createTaskFromMessage = (messageId: string, body: TaskInput) =>
  apiData<{ task: Task }>(`/messages/${messageId}/task`, { method: 'POST', body });

export const updateTask = (taskId: string, body: TaskInput) =>
  apiData<{ task: Task }>(`/tasks/${taskId}`, { method: 'PATCH', body });

export const deleteTask = (taskId: string) =>
  apiData<{ id: string }>(`/tasks/${taskId}`, { method: 'DELETE' });

export const listMyTasks = () => apiData<{ tasks: Task[] }>('/tasks');

// Only people in the chat can be assigned (the backend enforces it too).
// Asks the server, so the list always matches its rule: project members for
// a project channel / ticket (home + linked channels), else channel members
// or DM participants. Pass a task (has `id`) to get its ticket's list.
export const listAssignable = async (target: {
  id?: string;
  projectKey?: string;
  channelId: string | null;
  conversationId: string | null;
}): Promise<User[]> => {
  const query = target.projectKey
    ? `projectKey=${encodeURIComponent(target.projectKey)}`
    : target.id
      ? `taskId=${target.id}`
      : target.channelId
        ? `channelId=${target.channelId}`
        : target.conversationId
          ? `conversationId=${target.conversationId}`
          : '';
  if (!query) {
    return [];
  }
  const { users } = await apiData<{ users: User[] }>(`/tasks/assignable?${query}`);
  return users;
};

export const listChannelTasks = (channelId: string) =>
  apiData<{ tasks: Task[] }>(`/channels/${channelId}/tasks`);

export const listConversationTasks = (conversationId: string) =>
  apiData<{ tasks: Task[] }>(`/conversations/${conversationId}/tasks`);

export const createTaskInChat = (
  target: { channelId?: string | null; conversationId?: string | null },
  body: TaskInput,
) =>
  apiData<{ task: Task }>(
    target.channelId
      ? `/channels/${target.channelId}/tasks`
      : `/conversations/${target.conversationId}/tasks`,
    { method: 'POST', body },
  );

/**
 * Mirrors the backend rule (task.controller assertCanEdit):
 *   full:       creator / moderator / admin: every field
 *   progress:   assignee: status + description
 *   unassigned: anyone in the chat: status + description, or assign themselves
 */
export type TaskAccess = 'full' | 'progress' | 'unassigned' | 'none';

export const taskAccess = (
  task: Task,
  userId: string | undefined,
  canModerate = false,
): TaskAccess => {
  if (canModerate || task.createdBy.id === userId) return 'full';
  if (task.assignees.length === 0) return 'unassigned';
  return task.assignees.some((assignee) => assignee.id === userId) ? 'progress' : 'none';
};

// Status changes and the edit button: anyone but 'none'.
export const canManageTask = (task: Task, userId: string | undefined, canModerate = false) =>
  taskAccess(task, userId, canModerate) !== 'none';

// A comment in a ticket's own thread (never posted to the chat).
export const addTaskComment = (
  taskId: string,
  content: string,
  attachments: PendingAttachment[] = [],
) =>
  apiData<{ message: Message }>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    body: { content, ...(attachments.length ? { attachments } : {}) },
  });

// The "Unassigned" board: tasks in no project, from chats the user can read.
export const listUnassignedTasks = () => apiData<{ tasks: Task[] }>('/tasks/unassigned');

// Moves an unassigned task into a project (it gets the project's next key).
export const moveTaskToProject = (taskId: string, projectId: string) =>
  apiData<{ task: Task }>(`/tasks/${taskId}/project`, { method: 'POST', body: { projectId } });
