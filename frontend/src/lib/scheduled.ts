import { apiData } from './api';
import type { ScheduledMessage, ScheduleTarget } from '@/types/scheduled';

const basePath = (target: ScheduleTarget) =>
  target.kind === 'channel' ? `/channels/${target.id}` : `/conversations/${target.id}`;

export const listScheduled = () => apiData<{ scheduled: ScheduledMessage[] }>('/scheduled');

export const createScheduled = (target: ScheduleTarget, content: string, scheduledAt: Date) =>
  apiData<{ scheduled: ScheduledMessage }>(`${basePath(target)}/scheduled`, {
    method: 'POST',
    body: {
      content,
      scheduledAt: scheduledAt.toISOString(),
      parentMessageId: target.parentMessageId ?? undefined,
      alsoSendToChannel: target.alsoSendToChannel ?? undefined,
    },
  });

export const updateScheduled = (id: string, body: { content?: string; scheduledAt?: string }) =>
  apiData<{ scheduled: ScheduledMessage }>(`/scheduled/${id}`, { method: 'PATCH', body });

export const cancelScheduled = (id: string) =>
  apiData<{ id: string }>(`/scheduled/${id}`, { method: 'DELETE' });

export const sendScheduledNow = (id: string) =>
  apiData<{ message: unknown }>(`/scheduled/${id}/send`, { method: 'POST' });

/** Does this scheduled message belong to the given composer? */
export const matchesTarget = (item: ScheduledMessage, target: ScheduleTarget) =>
  (target.kind === 'channel' ? item.channelId : item.conversationId) === target.id &&
  (item.parentMessageId ?? null) === (target.parentMessageId ?? null);
