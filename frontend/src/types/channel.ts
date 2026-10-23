import type { User } from './user';

export type ChannelType = 'PUBLIC' | 'PRIVATE';

export type ChannelStatus = 'ACTIVE' | 'ARCHIVED';

export type ChannelRole = 'MODERATOR' | 'MEMBER';

export type ChannelNotify = 'ALL' | 'MENTIONS' | 'MUTE';

export type ChannelMembership = {
  id: string;
  role: ChannelRole;
  notifyPreference: ChannelNotify;
  starred: boolean;
  joinedAt: string;
  lastReadAt: string;
};

export type Channel = {
  id: string;
  name: string;
  topic: string;
  purpose: string;
  type: ChannelType;
  status: ChannelStatus;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  isMember: boolean;
  membership: ChannelMembership | null;
};

export type ChannelMember = ChannelMembership & { user: User };
