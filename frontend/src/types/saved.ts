import type { Message } from './message';
import type { User } from './user';

export type PinnedMessage = {
  id: string;
  channelId: string;
  messageId: string;
  pinnedBy: User | null;
  createdAt: string;
  message: Message;
};

export type SavedMessage = {
  id: string;
  messageId: string;
  createdAt: string;
  message: Message;
};
