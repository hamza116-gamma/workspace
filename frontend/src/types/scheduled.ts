export type ScheduledMessage = {
  id: string;
  channelId: string | null;
  conversationId: string | null;
  parentMessageId: string | null;
  alsoSendToChannel: boolean;
  /** Slack text, like a normal message. */
  content: string;
  scheduledAt: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
};

/** Where a scheduled message will be posted. */
export type ScheduleTarget = {
  kind: 'channel' | 'conversation';
  id: string;
  /** Thread reply (root message id). */
  parentMessageId?: string | null;
  alsoSendToChannel?: boolean;
};
