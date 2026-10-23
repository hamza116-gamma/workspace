'use client';

import { useAuth } from '@/hooks/useAuth';
import { useChannels } from '@/hooks/useChannels';
import { useConversations } from '@/hooks/useConversations';
import type { Huddle } from '@/types/huddle';

// "#design" for channel huddles, the other people's names for DMs.
export const useHuddleTitle = (huddle: Huddle | null) => {
  const { user } = useAuth();
  const { channels } = useChannels();
  const { conversations } = useConversations();
  if (!huddle) return '';
  if (huddle.channelId) {
    const channel = channels.find((item) => item.id === huddle.channelId);
    return channel ? `#${channel.name}` : 'Channel huddle';
  }
  const conversation = conversations.find((item) => item.id === huddle.conversationId);
  const names = (conversation?.participants ?? [])
    .filter((participant) => participant.user.id !== user?.id)
    .map((participant) => participant.user.fullName.split(' ')[0]);
  return names.length ? names.join(', ') : 'Direct message';
};

export const huddleHref = (huddle: Huddle) =>
  huddle.channelId ? `/channels/${huddle.channelId}` : `/dm/${huddle.conversationId}`;
