import type { Message, MessageAttachment } from './message';
import type { User } from './user';
import type { Task } from './task';

export type SearchType = 'all' | 'messages' | 'channels' | 'people' | 'files' | 'tasks';

export type SearchLocation = { kind: 'channel' | 'conversation'; id: string; name: string };

export type SearchMessage = Message & { location: SearchLocation };

export type SearchChannel = {
  id: string;
  name: string;
  topic: string;
  purpose: string;
  type: 'PUBLIC' | 'PRIVATE';
  status: string;
  isMember: boolean;
};

export type SearchPerson = User & { orgRole: string };

export type SearchFile = MessageAttachment & {
  messageId: string;
  channelId: string | null;
  conversationId: string | null;
};

export type SearchList<T> = { items: T[]; hasMore: boolean };

export type SearchResult = {
  query: string;
  type: SearchType;
  page: number;
  messages: SearchList<SearchMessage>;
  channels: SearchList<SearchChannel>;
  people: SearchList<SearchPerson>;
  files: SearchList<SearchFile>;
  tasks: SearchList<Task>;
};
