import { apiData } from './api';
import type { Draft, DraftTarget } from '@/types/draft';

export const draftKey = (target: DraftTarget) => {
  if (target.threadRootId) {
    return `thread:${target.threadRootId}`;
  }
  if (target.channelId) {
    return `channel:${target.channelId}`;
  }
  return `conversation:${target.conversationId}`;
};

export const listDrafts = () => apiData<{ drafts: Draft[] }>('/drafts');

/** Empty content deletes the draft (draft: null). */
export const putDraft = (target: DraftTarget, content: string) =>
  apiData<{ key: string; draft: Draft | null }>('/drafts', {
    method: 'PUT',
    body: { ...target, content },
  });

export const deleteDraft = (id: string) =>
  apiData<{ key: string; draft: null }>(`/drafts/${id}`, { method: 'DELETE' });
