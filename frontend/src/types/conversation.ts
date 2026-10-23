import type { User } from './user';

export type ConversationType = 'DIRECT' | 'GROUP';

export type ConversationParticipant = {
  user: User;
  joinedAt: string;
  lastReadAt: string;
};

export type Conversation = {
  id: string;
  type: ConversationType;
  participants: ConversationParticipant[];
  /** The viewer's own mute preference. */
  muted: boolean;
  lastActivityAt: string;
  createdAt: string;
};
