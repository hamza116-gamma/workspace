export type HuddleUser = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
};

export type HuddleParticipant = {
  user: HuddleUser;
  joinedAt: string;
};

export type HuddleInviteStatus = 'RINGING' | 'DECLINED' | 'MISSED';

export type HuddleInvite = {
  user: HuddleUser;
  status: HuddleInviteStatus;
  expiresAt: string;
};

export type Huddle = {
  id: string;
  organizationId: string;
  channelId: string | null;
  conversationId: string | null;
  startedBy: HuddleUser;
  status: 'LIVE' | 'ENDED';
  participants: HuddleParticipant[];
  invites: HuddleInvite[];
  hadVideo: boolean;
  hadScreenShare: boolean;
  messageId: string | null;
  outcome: 'MISSED' | 'DECLINED' | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
};

// Where a huddle lives: a channel or a DM / group DM.
export type HuddleTarget = { kind: 'channel' | 'conversation'; id: string };

export type HuddlePeerMedia = {
  audio: boolean;
  video: boolean;
  screen: boolean;
};

export type HuddleRing = {
  huddle: Huddle;
  caller: HuddleUser;
  silent: boolean;
};

export type HuddleSignalType = 'offer' | 'answer' | 'ice';
