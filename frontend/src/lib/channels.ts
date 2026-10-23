import { apiData } from './api';
import type {
  Channel,
  ChannelMember,
  ChannelMembership,
  ChannelNotify,
  ChannelType,
} from '@/types/channel';
import type { User } from '@/types/user';

export type CreateChannelInput = {
  name: string;
  type?: ChannelType;
  topic?: string;
  purpose?: string;
};

export type UpdateChannelInput = {
  name?: string;
  topic?: string;
  purpose?: string;
};

export const listChannels = (options: { joinedOnly?: boolean; archived?: boolean } = {}) => {
  const params = new URLSearchParams();
  if (options.joinedOnly) params.set('joined', 'true');
  if (options.archived) params.set('archived', 'true');
  const query = params.toString();
  return apiData<{ channels: Channel[] }>(`/channels${query ? `?${query}` : ''}`);
};

export const unarchiveChannel = (channelId: string) =>
  apiData<{ channel: Channel }>(`/channels/${channelId}/unarchive`, { method: 'POST' });

export const getChannel = (channelId: string) =>
  apiData<{ channel: Channel }>(`/channels/${channelId}`);

export const createChannel = (body: CreateChannelInput) =>
  apiData<{ channel: Channel }>('/channels', { method: 'POST', body });

export const updateChannel = (channelId: string, body: UpdateChannelInput) =>
  apiData<{ channel: Channel }>(`/channels/${channelId}`, { method: 'PATCH', body });

export const archiveChannel = (channelId: string) =>
  apiData<{ channel: Channel }>(`/channels/${channelId}`, { method: 'DELETE' });

export const joinChannel = (channelId: string) =>
  apiData<{ channel: Channel; membership: ChannelMembership }>(`/channels/${channelId}/join`, {
    method: 'POST',
  });

export const leaveChannel = (channelId: string) =>
  apiData<{ message: string }>(`/channels/${channelId}/leave`, { method: 'POST' });

export const listChannelMembers = (channelId: string) =>
  apiData<{ members: ChannelMember[] }>(`/channels/${channelId}/members`);

export const listChannelCandidates = (channelId: string) =>
  apiData<{ candidates: { user: User }[] }>(`/channels/${channelId}/candidates`);

export const addChannelMembers = (channelId: string, userIds: string[]) =>
  apiData<{ added: number }>(`/channels/${channelId}/members`, {
    method: 'POST',
    body: { userIds },
  });

export const removeChannelMember = (channelId: string, userId: string) =>
  apiData<{ message: string }>(`/channels/${channelId}/members/${userId}`, { method: 'DELETE' });

export type ChannelPreferencesInput = { notifyPreference?: ChannelNotify; starred?: boolean };

export const setMyChannelPreferences = (channelId: string, body: ChannelPreferencesInput) =>
  apiData<{ membership: ChannelMembership }>(`/channels/${channelId}/members/me`, {
    method: 'PATCH',
    body,
  });

export const updateChannelPreference = (channelId: string, notifyPreference: ChannelNotify) =>
  setMyChannelPreferences(channelId, { notifyPreference });
