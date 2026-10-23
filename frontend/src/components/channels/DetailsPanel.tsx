'use client';

import { useParams } from 'next/navigation';
import { ChannelDetailsPanel } from './ChannelDetailsPanel';
import { ConversationDetailsPanel } from '@/components/conversation/ConversationDetailsPanel';

export const DetailsPanel = () => {
  const params = useParams<{ channelId?: string; conversationId?: string }>();

  if (params?.conversationId) {
    return <ConversationDetailsPanel />;
  }
  return <ChannelDetailsPanel />;
};
