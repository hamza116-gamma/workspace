import { apiData } from './api';
import { listChannelMembers } from './channels';
import { getConversation } from './conversations';
import type { Task, TaskInput } from '@/types/task';
import type { User } from '@/types/user';

export const createTaskFromMessage = (messageId: string, body: TaskInput) =>
  apiData<{ task: Task }>(`/messages/${messageId}/task`, { method: 'POST', body });

export const updateTask = (taskId: string, body: TaskInput) =>
  apiData<{ task: Task }>(`/tasks/${taskId}`, { method: 'PATCH', body });

export const deleteTask = (taskId: string) =>
  apiData<{ id: string }>(`/tasks/${taskId}`, { method: 'DELETE' });

export const listMyTasks = () => apiData<{ tasks: Task[] }>('/tasks');

// Only people in the chat can be assigned (the backend enforces it too).
export const listAssignable = async (target: {
  channelId: string | null;
  conversationId: string | null;
}): Promise<User[]> => {
  if (target.channelId) {
    const { members } = await listChannelMembers(target.channelId);
    return members.map((member) => member.user);
  }
  if (target.conversationId) {
    const { conversation } = await getConversation(target.conversationId);
    return conversation.participants.map((participant) => participant.user);
  }
  return [];
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
