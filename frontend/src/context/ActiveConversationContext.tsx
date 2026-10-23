'use client';

import { createContext, useMemo } from 'react';
import { useConversations } from '@/hooks/useConversations';
import { useChatDetails } from '@/hooks/useChatDetails';
import { dropChat, fetchConversationDetails, peekConversation } from '@/lib/chatCache';
import type { Conversation } from '@/types/conversation';

type ActiveConversationValue = {
  conversation: Conversation | null;
  /** The conversation id last requested with load() (null after clear()). */
  targetId: string | null;
  loading: boolean;
  error: string;
  load: (conversationId: string) => void;
  reload: () => Promise<void>;
  clear: () => void;
};

export const ActiveConversationContext = createContext<ActiveConversationValue | null>(null);

export const ActiveConversationProvider = ({ children }: { children: React.ReactNode }) => {
  const { conversations } = useConversations();
  // Header seed: the chat cache, else the sidebar's copy of the DM.
  const { item, targetId, loading, error, load, reload, clear } = useChatDetails<Conversation>({
    fetch: fetchConversationDetails,
    seed: (id) =>
      peekConversation(id) ?? conversations.find((conversation) => conversation.id === id),
    forget: (id) => dropChat('conversation', id),
    fallbackError: 'Unable to load conversation',
  });

  const value = useMemo<ActiveConversationValue>(
    () => ({ conversation: item, targetId, loading, error, load, reload, clear }),
    [item, targetId, loading, error, load, reload, clear],
  );

  return (
    <ActiveConversationContext.Provider value={value}>
      {children}
    </ActiveConversationContext.Provider>
  );
};
