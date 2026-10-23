import { apiData } from './api';
import type { User } from '@/types/user';
import type { Huddle, HuddleTarget } from '@/types/huddle';

type HuddleResponse = { huddle: Huddle };

const targetBody = (target: HuddleTarget) =>
  target.kind === 'channel' ? { channelId: target.id } : { conversationId: target.id };

export const huddleTargetKey = (target: HuddleTarget) => `${target.kind}:${target.id}`;

export const huddleKeyFor = (huddle: Huddle) =>
  huddle.channelId ? `channel:${huddle.channelId}` : `conversation:${huddle.conversationId}`;

export const startHuddle = (target: HuddleTarget) =>
  apiData<HuddleResponse>('/huddles', { method: 'POST', body: targetBody(target) });

export const listActiveHuddles = () => apiData<{ huddles: Huddle[] }>('/huddles/active');

export const listHuddleHistory = (target: HuddleTarget) => {
  const query = target.kind === 'channel' ? 'channelId' : 'conversationId';
  return apiData<{ huddles: Huddle[] }>(
    `/huddles/history?${query}=${encodeURIComponent(target.id)}`,
  );
};

const action = (id: string, name: string) =>
  apiData<HuddleResponse>(`/huddles/${id}/${name}`, { method: 'POST' });

export const joinHuddle = (id: string) => action(id, 'join');
export const leaveHuddle = (id: string) => action(id, 'leave');
export const endHuddle = (id: string) => action(id, 'end');
export const declineHuddle = (id: string) => action(id, 'decline');

export const listHuddleCandidates = (id: string) =>
  apiData<{ users: User[] }>(`/huddles/${id}/candidates`);

export const inviteToHuddle = (id: string, userIds: string[]) =>
  apiData<HuddleResponse>(`/huddles/${id}/invite`, { method: 'POST', body: { userIds } });
