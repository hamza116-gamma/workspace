'use client';

import { useCallback } from 'react';
import { useConversations } from './useConversations';
import { setConversationPreferences } from '@/lib/conversations';

/** Persisted DM mute toggle (optimistic, rolled back on failure). */
export const useConversationMute = () => {
  const { conversations, patchConversation } = useConversations();

  const isMuted = useCallback(
    (conversationId: string, fallback = false) => {
      const found = conversations.find((conversation) => conversation.id === conversationId);
      return found ? Boolean(found.muted) : fallback;
    },
    [conversations],
  );

  const setMuted = useCallback(
    async (conversationId: string, muted: boolean) => {
      patchConversation(conversationId, (conversation) => ({ ...conversation, muted }));
      try {
        await setConversationPreferences(conversationId, { muted });
      } catch (err) {
        patchConversation(conversationId, (conversation) => ({ ...conversation, muted: !muted }));
        throw err;
      }
    },
    [patchConversation],
  );

  return { isMuted, setMuted };
};
