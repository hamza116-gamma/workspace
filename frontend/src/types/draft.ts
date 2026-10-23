export type Draft = {
  id: string;
  /** channel:<id> | conversation:<id> | thread:<rootId> */
  key: string;
  channelId: string | null;
  conversationId: string | null;
  threadRootId: string | null;
  content: string;
  updatedAt: string;
};

/** Which composer a draft belongs to (exactly one id). */
export type DraftTarget =
  | { channelId: string; conversationId?: never; threadRootId?: never }
  | { conversationId: string; channelId?: never; threadRootId?: never }
  | { threadRootId: string; channelId?: never; conversationId?: never };
