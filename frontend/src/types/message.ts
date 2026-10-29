import type { User } from './user';
import type { Task } from './task';

export type ReactionUser = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
};

export type MessageReaction = {
  emoji: string;
  count: number;
  users: ReactionUser[];
  reactedByMe: boolean;
};

export type AttachmentKind = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';

export type MessageAttachment = {
  id: string;
  kind: AttachmentKind;
  url: string;
  publicId: string;
  name: string;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  createdAt: string;
};

// An attachment that has been uploaded to Cloudinary but not yet sent with a
// message. Matches the reference the backend expects on message create.
export type PendingAttachment = {
  url: string;
  publicId: string;
  resourceType: string;
  kind: AttachmentKind;
  originalName: string;
  mimeType: string;
  bytes: number;
  format: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
};

export type Message = {
  id: string;
  channelId: string | null;
  conversationId: string | null;
  sender: User;
  content: string;
  parentMessageId: string | null;
  alsoSentToChannel: boolean;
  replyCount: number;
  lastReplyAt: string | null;
  replyUserIds: string[];
  mentions: { id: string; fullName: string }[];
  mentionAll: boolean;
  mentionHere: boolean;
  reactions: MessageReaction[];
  attachments: MessageAttachment[];
  // Set on a huddle call-log card (Huddle.message).
  huddleId?: string | null;
  // Set when the message is a task card (its thread is the discussion).
  taskId?: string | null;
  // Part of a ticket's own thread (hidden anchor + comments).
  ticketThread?: boolean;
  // App-written note in a task thread ("moved this to Done").
  activity?: boolean;
  task?: Task | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
