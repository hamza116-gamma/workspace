import { apiData } from './api';
import type { Conversation } from '@/types/conversation';
import type { User } from '@/types/user';

export const listConversations = () => apiData<{ conversations: Conversation[] }>('/conversations');

export const getConversation = (conversationId: string) =>
  apiData<{ conversation: Conversation }>(`/conversations/${conversationId}`);

export const createConversation = (userIds: string[]) =>
  apiData<{ conversation: Conversation }>('/conversations', {
    method: 'POST',
    body: { userIds },
  });

export const findConversation = (userIds: string[]) =>
  apiData<{ conversation: Conversation | null }>('/conversations/find', {
    method: 'POST',
    body: { userIds },
  });

export const addConversationParticipants = (conversationId: string, userIds: string[]) =>
  apiData<{ conversation: Conversation }>(`/conversations/${conversationId}/participants`, {
    method: 'POST',
    body: { userIds },
  });

export const setConversationPreferences = (conversationId: string, body: { muted: boolean }) =>
  apiData<{ conversation: Conversation }>(`/conversations/${conversationId}/preferences`, {
    method: 'PATCH',
    body,
  });

export const listConversationCandidates = () =>
  apiData<{ candidates: { user: User }[] }>('/conversations/candidates');
