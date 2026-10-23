'use client';

import { useEffect, useRef } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { useSocket } from '@/hooks/useSocket';
import { useActiveChannel } from '@/hooks/useActiveChannel';
import { useActiveConversation } from '@/hooks/useActiveConversation';
import {
  applyLiveMessage,
  dropChat,
  fetchChannelDetails,
  peekChannel,
  refreshCachedChat,
} from '@/lib/chatCache';
import type { Message } from '@/types/message';

type MessagePayload = { message?: Message };
type UnreadPayload = {
  organizationId?: string;
  channelId: string | null;
  conversationId: string | null;
};

// Keeps cached chats current while they are not on screen: live message
// events (created / edited / reactions / deleted / thread stats) patch the
// cached window; unread.updated (the only event for rooms we are not in)
// refreshes that chat's cached copy; channel.updated refreshes cached
// header details; losing a channel membership forgets the channel.
export const ChatCacheSync = () => {
  const { active } = useOrg();
  const { socket } = useSocket();
  const { targetId: openChannelId } = useActiveChannel();
  const { targetId: openConversationId } = useActiveConversation();
  const openRef = useRef({ openChannelId, openConversationId });
  useEffect(() => {
    openRef.current = { openChannelId, openConversationId };
  });

  const organizationId = active?.id ?? null;

  useEffect(() => {
    if (!socket || !organizationId) return;
    const onCreated = ({ message }: MessagePayload) => {
      if (message) applyLiveMessage('created', message);
    };
    const onUpdated = ({ message }: MessagePayload) => {
      if (message) applyLiveMessage('updated', message);
    };
    const onDeleted = ({ message }: MessagePayload) => {
      if (message) applyLiveMessage('deleted', message);
    };
    const onUnread = (payload: UnreadPayload) => {
      if (payload.organizationId && payload.organizationId !== organizationId) return;
      const open = openRef.current;
      if (payload.channelId && payload.channelId !== open.openChannelId) {
        void refreshCachedChat('channel', payload.channelId);
      } else if (payload.conversationId && payload.conversationId !== open.openConversationId) {
        void refreshCachedChat('conversation', payload.conversationId);
      }
    };
    const onChannelUpdated = (payload: { channelId?: string }) => {
      const id = payload?.channelId ? String(payload.channelId) : null;
      if (id && peekChannel(id) && id !== openRef.current.openChannelId) {
        void fetchChannelDetails(id).catch(() => dropChat('channel', id));
      }
    };
    const onMembership = (payload: { channelId?: string; member?: boolean }) => {
      if (payload?.channelId && payload.member === false) {
        dropChat('channel', String(payload.channelId));
      }
    };

    socket.on('message.created', onCreated);
    socket.on('message.updated', onUpdated);
    socket.on('message.deleted', onDeleted);
    socket.on('thread.updated', onDeleted);
    socket.on('unread.updated', onUnread);
    socket.on('channel.updated', onChannelUpdated);
    socket.on('channel.membership.updated', onMembership);
    return () => {
      socket.off('message.created', onCreated);
      socket.off('message.updated', onUpdated);
      socket.off('message.deleted', onDeleted);
      socket.off('thread.updated', onDeleted);
      socket.off('unread.updated', onUnread);
      socket.off('channel.updated', onChannelUpdated);
      socket.off('channel.membership.updated', onMembership);
    };
  }, [socket, organizationId]);

  return null;
};
