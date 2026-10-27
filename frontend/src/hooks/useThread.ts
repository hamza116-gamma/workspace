'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useSocket } from './useSocket';
import { useTypingUsers, type ComposerActivity, type TypingPayload } from './useTypingUsers';
import {
  deleteMessage,
  followThread,
  getThread,
  sendChannelMessage,
  sendConversationMessage,
  toggleReaction,
  unfollowThread,
  updateMessage,
} from '@/lib/messages';
import type { Message, PendingAttachment } from '@/types/message';
import { addTaskComment } from '@/lib/tasks';

type MessagePayload = { message: Message };

export const useThread = (rootId: string | null) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [root, setRoot] = useState<Message | null>(null);
  const [replies, setReplies] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(false);
  const { typingUsers, recordingUsers, applyTyping, resetTyping } = useTypingUsers(user?.id);

  const load = useCallback(async () => {
    if (!rootId) {
      setRoot(null);
      setReplies([]);
      setFollowing(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getThread(rootId);
      setRoot(result.message);
      setReplies(result.replies);
      setFollowing(result.following);
      setError('');
    } catch (err) {
      setRoot(null);
      setReplies([]);
      setError(err instanceof Error ? err.message : 'Unable to load thread');
    } finally {
      setLoading(false);
    }
  }, [rootId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upsertReply = useCallback((message: Message) => {
    setReplies((prev) =>
      prev.some((item) => item.id === message.id)
        ? prev.map((item) => (item.id === message.id ? message : item))
        : [...prev, message],
    );
  }, []);

  const applyMessage = useCallback(
    (message: Message) => {
      if (message.parentMessageId === rootId) {
        upsertReply(message);
      } else if (message.id === rootId) {
        setRoot(message);
      }
    },
    [rootId, upsertReply],
  );

  useEffect(() => {
    if (!socket || !rootId) {
      return;
    }
    // Rejoin after a reconnect (a new socket has no rooms), then reload.
    const join = () => socket.emit('thread:join', rootId);
    const onReconnect = () => {
      join();
      resetTyping();
      void load();
    };
    join();

    const onMessage = (payload: MessagePayload) => applyMessage(payload.message);
    const onDeleted = (payload: MessagePayload) => {
      const deletedId = payload.message.id;
      setReplies((prev) => prev.filter((item) => item.id !== deletedId));
      if (deletedId === rootId) {
        // A deleted root stays as a placeholder; replies remain reachable.
        setRoot(payload.message);
      }
    };
    const onThreadUpdated = (payload: MessagePayload) => {
      if (payload.message.id === rootId) {
        setRoot(payload.message);
      }
    };
    const onTyping = (payload: TypingPayload) => {
      if (payload.kind === 'thread' && String(payload.id) === String(rootId)) {
        applyTyping(payload);
      }
    };

    resetTyping();
    socket.on('connect', onReconnect);
    socket.on('message.created', onMessage);
    socket.on('message.updated', onMessage);
    socket.on('message.deleted', onDeleted);
    socket.on('thread.updated', onThreadUpdated);
    socket.on('typing.updated', onTyping);

    return () => {
      socket.emit('thread:leave', rootId);
      socket.off('connect', onReconnect);
      socket.off('message.created', onMessage);
      socket.off('message.updated', onMessage);
      socket.off('message.deleted', onDeleted);
      socket.off('thread.updated', onThreadUpdated);
      socket.off('typing.updated', onTyping);
    };
  }, [socket, rootId, applyMessage, applyTyping, resetTyping, load]);

  const send = useCallback(
    async (content: string, alsoSendToChannel: boolean, attachments: PendingAttachment[] = []) => {
      if (!rootId || !root) {
        return;
      }
      const trimmed = content.trim();
      if (!trimmed && attachments.length === 0) {
        return;
      }
      const options = {
        parentMessageId: rootId,
        alsoSendToChannel,
        ...(attachments.length ? { attachments } : {}),
      };
      // A ticket's own thread: comments go through the ticket (works for
      // every project member, incl. linked channels; never to the chat).
      const result =
        root.ticketThread && root.taskId
          ? await addTaskComment(root.taskId, trimmed, attachments)
          : root.channelId
            ? await sendChannelMessage(root.channelId, trimmed, options)
            : await sendConversationMessage(root.conversationId as string, trimmed, options);
      applyMessage(result.message);
    },
    [rootId, root, applyMessage],
  );

  const react = useCallback(
    async (messageId: string, emoji: string) =>
      applyMessage((await toggleReaction(messageId, emoji)).message),
    [applyMessage],
  );

  const edit = useCallback(
    async (messageId: string, content: string) =>
      applyMessage((await updateMessage(messageId, content)).message),
    [applyMessage],
  );

  const remove = useCallback(
    async (messageId: string) => {
      const result = await deleteMessage(messageId);
      setReplies((prev) => prev.filter((item) => item.id !== messageId));
      if (messageId === rootId) {
        setRoot(result.message);
      }
    },
    [rootId],
  );

  const setTypingActive = useCallback(
    (active: boolean, activity: ComposerActivity = 'typing') => {
      if (!socket || !rootId) {
        return;
      }
      socket.emit(active ? 'typing.start' : 'typing.stop', {
        kind: 'thread',
        id: rootId,
        activity,
      });
    },
    [socket, rootId],
  );

  const toggleFollow = useCallback(async () => {
    if (!rootId) {
      return;
    }
    if (following) {
      await unfollowThread(rootId);
      setFollowing(false);
    } else {
      await followThread(rootId);
      setFollowing(true);
    }
  }, [rootId, following]);

  return {
    root,
    replies,
    loading,
    error,
    following,
    typingUsers,
    recordingUsers,
    send,
    react,
    edit,
    remove,
    setTyping: setTypingActive,
    toggleFollow,
    reload: load,
  };
};
