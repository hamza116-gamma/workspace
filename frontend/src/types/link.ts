import type { User } from './user';

export type MessageLink = {
  id: string;
  url: string;
  messageId: string;
  sender: User;
  createdAt: string;
};
