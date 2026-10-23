'use client';

import { useMemo } from 'react';
import { useChannels } from './useChannels';
import { useConversations } from './useConversations';

/**
 * Ids of channels (notify preference MUTE) and DMs the viewer muted. Muted
 * chats are left out of workspace / tab badges (mentions still count).
 */
export const useMutedTargets = () => {
  const { channels } = useChannels();
  const { conversations } = useConversations();

  return useMemo(
    () => ({
      channelIds: new Set(
        channels
          .filter((channel) => channel.membership?.notifyPreference === 'MUTE')
          .map((channel) => channel.id),
      ),
      conversationIds: new Set(
        conversations
          .filter((conversation) => conversation.muted)
          .map((conversation) => conversation.id),
      ),
    }),
    [channels, conversations],
  );
};
