'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useSocket } from './useSocket';
import { useTypingUsers, type TypingPayload } from './useTypingUsers';
import {
  deleteMessage,
  listChannelMessages,
  listConversationMessages,
  sendChannelMessage,
  sendConversationMessage,
  toggleReaction,
  updateMessage,
} from '@/lib/messages';
import {
  PAGE_SIZE,
  appendOrReplace,
  appendPage,
  applyDeleted,
  isMainListMessage,
  mergeLatestPage,
  prependPage,
  replaceIfPresent,
} from '@/lib/messageList';
import {
  dropChat,
  fetchLatestMessages,
  getChatSnapshot,
  isAccessLost,
  saveChatSnapshot,
} from '@/lib/chatCache';
import type { Message, PendingAttachment } from '@/types/message';

export type MessageTarget = { kind: 'channel' | 'conversation'; id: string };

type MessagePayload = { message: Message };

type Kind = MessageTarget['kind'];

const fetchPage = (kind: Kind, id: string, before?: string, after?: string) =>
  kind === 'channel'
    ? listChannelMessages(id, before, after)
    : listConversationMessages(id, before, after);

const parseKey = (key: string | null) => {
  if (!key) return null;
  const [kind, id] = key.split(':') as [Kind, string];
  return { kind, id };
};

export const useMessages = (target: MessageTarget | null) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const kind = target?.kind ?? null;
  const id = target?.id ?? null;
  const chatKey = kind && id ? `${kind}:${id}` : null;

  // `ownerKey` changes in the SAME update as `messages`, so the window is
  // never attributed (or cached) to the wrong chat.
  const [ownerKey, setOwnerKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasOlder, setHasOlder] = useState(false);
  const [hasNewer, setHasNewer] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);
  // Incremented when the window is replaced by the latest page (MessageList
  // then scrolls to the bottom).
  const [latestToken, setLatestToken] = useState(0);
  const { typingUsers, applyTyping, resetTyping } = useTypingUsers(user?.id);

  // Switching chats: show the cached window during this very render (no
  // spinner, no flash of the previous chat).
  if (ownerKey !== chatKey) {
    const parsed = parseKey(chatKey);
    const snapshot = parsed ? getChatSnapshot(parsed.kind, parsed.id) : undefined;
    setOwnerKey(chatKey);
    setMessages(snapshot?.messages ?? []);
    setHasOlder(snapshot?.hasOlder ?? false);
    setHasNewer(false);
    setLoading(Boolean(chatKey) && !snapshot);
    setError('');
    setLoadingOlder(false);
    setLoadingNewer(false);
  }

  // Responses for a chat the user already left are dropped.
  const currentKey = useRef<string | null>(chatKey);
  const messagesRef = useRef<Message[]>([]);
  const hasNewerRef = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    currentKey.current = chatKey;
  }, [chatKey]);

  useEffect(() => {
    messagesRef.current = messages;
    hasNewerRef.current = hasNewer;
  }, [messages, hasNewer]);

  // Keep the memory cache in step with the latest window (never a
  // scrolled-back one).
  useEffect(() => {
    const parsed = parseKey(ownerKey);
    if (!parsed || ownerKey !== chatKey || loading || error || hasNewer) return;
    saveChatSnapshot(parsed.kind, parsed.id, messages, hasOlder);
  }, [ownerKey, chatKey, messages, hasOlder, hasNewer, loading, error]);

  const onLoadError = useCallback((key: string, err: unknown) => {
    const parsed = parseKey(key);
    if (parsed && isAccessLost(err)) dropChat(parsed.kind, parsed.id);
    setMessages([]);
    setError(err instanceof Error ? err.message : 'Unable to load messages');
  }, []);

  // Cached: silent background refresh merged into what is shown.
  // Not cached: a normal (spinner) load.
  const load = useCallback(async () => {
    if (!kind || !id) {
      setLoading(false);
      return;
    }
    const key = `${kind}:${id}`;
    currentKey.current = key;
    const cached = Boolean(getChatSnapshot(kind, id));
    try {
      const page = await fetchLatestMessages(kind, id);
      if (currentKey.current !== key) return;
      if (cached && messagesRef.current.length > 0 && !hasNewerRef.current) {
        const merged = mergeLatestPage(messagesRef.current, page);
        setMessages(merged.messages);
        if (merged.replaced) setHasOlder(page.length >= PAGE_SIZE);
      } else if (!hasNewerRef.current) {
        setMessages(page);
        setHasOlder(page.length >= PAGE_SIZE);
      }
      setError('');
    } catch (err) {
      if (currentKey.current !== key) return;
      // A cached chat that fails for network reasons keeps what it shows.
      if (!cached || isAccessLost(err)) onLoadError(key, err);
    } finally {
      if (currentKey.current === key) setLoading(false);
    }
  }, [kind, id, onLoadError]);

  useEffect(() => {
    void load();
  }, [load]);

  // Cursor = oldest loaded _id. Past MAX_LOADED the newest are dropped.
  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current[0];
    if (!kind || !id || !oldest || busy.current || !hasOlder) return;
    const key = `${kind}:${id}`;
    busy.current = true;
    setLoadingOlder(true);
    try {
      const result = await fetchPage(kind, id, oldest.id);
      if (currentKey.current !== key) return;
      const older = result.messages.filter(isMainListMessage);
      const next = prependPage(messagesRef.current, older);
      setMessages(next.messages);
      setHasOlder(result.messages.length >= PAGE_SIZE);
      if (next.trimmed) setHasNewer(true);
    } catch {
      // Keep what is loaded; scrolling up again retries.
    } finally {
      busy.current = false;
      setLoadingOlder(false);
    }
  }, [kind, id, hasOlder]);

  // Pages the dropped newest messages back in (?after=), dropping the oldest.
  const loadNewer = useCallback(async () => {
    const newest = messagesRef.current[messagesRef.current.length - 1];
    if (!kind || !id || !newest || busy.current || !hasNewer) return;
    const key = `${kind}:${id}`;
    busy.current = true;
    setLoadingNewer(true);
    try {
      const result = await fetchPage(kind, id, undefined, newest.id);
      if (currentKey.current !== key) return;
      const next = appendPage(messagesRef.current, result.messages.filter(isMainListMessage));
      setMessages(next.messages);
      if (next.trimmed) setHasOlder(true);
      setHasNewer(result.messages.length >= PAGE_SIZE);
    } catch {
      // Scrolling down again retries.
    } finally {
      busy.current = false;
      setLoadingNewer(false);
    }
  }, [kind, id, hasNewer]);

  // "Jump to latest": replace the window with the latest page.
  const jumpToLatest = useCallback(async () => {
    if (!kind || !id) return;
    const key = `${kind}:${id}`;
    try {
      const page = await fetchLatestMessages(kind, id);
      if (currentKey.current !== key) return;
      hasNewerRef.current = false;
      setMessages(page);
      setHasOlder(page.length >= PAGE_SIZE);
      setHasNewer(false);
      setLatestToken((value) => value + 1);
    } catch {
      // Clicking again retries.
    }
  }, [kind, id]);

  // After a reconnect: merge the latest page into the loaded history.
  const resync = useCallback(async () => {
    if (!kind || !id || hasNewerRef.current) return;
    const key = `${kind}:${id}`;
    try {
      const page = await fetchLatestMessages(kind, id);
      if (currentKey.current !== key || hasNewerRef.current) return;
      const merged = mergeLatestPage(messagesRef.current, page);
      setMessages(merged.messages);
      if (merged.replaced) setHasOlder(page.length >= PAGE_SIZE);
    } catch (err) {
      if (currentKey.current === key && isAccessLost(err)) onLoadError(key, err);
    }
  }, [kind, id, onLoadError]);

  useEffect(() => {
    if (!socket || !kind || !id) return;
    const joinEvent = kind === 'channel' ? 'channel:join' : 'conversation:join';
    const leaveEvent = kind === 'channel' ? 'channel:leave' : 'conversation:leave';
    const isOurs = (message: Message) =>
      kind === 'channel' ? message.channelId === id : message.conversationId === id;

    // Socket.IO gives a reconnected socket no rooms: rejoin, then resync.
    const join = () => socket.emit(joinEvent, id);
    const onReconnect = () => {
      join();
      resetTyping();
      void resync();
    };

    // While scrolled far back (hasNewer) live messages are not appended:
    // they would leave a gap.
    const onCreated = ({ message }: MessagePayload) => {
      if (isOurs(message) && isMainListMessage(message) && !hasNewerRef.current) {
        setMessages((prev) => appendOrReplace(prev, message));
      }
    };
    const onUpdated = ({ message }: MessagePayload) => {
      if (isOurs(message)) setMessages((prev) => replaceIfPresent(prev, message));
    };
    // thread.updated carries the root: a deleted root vanishes with its
    // last reply.
    const onDeletedOrThread = ({ message }: MessagePayload) => {
      if (isOurs(message)) setMessages((prev) => applyDeleted(prev, message));
    };
    const onTyping = (payload: TypingPayload) => {
      if (payload.kind === kind && String(payload.id) === String(id)) applyTyping(payload);
    };

    resetTyping();
    join();
    socket.on('connect', onReconnect);
    socket.on('message.created', onCreated);
    socket.on('message.updated', onUpdated);
    socket.on('message.deleted', onDeletedOrThread);
    socket.on('thread.updated', onDeletedOrThread);
    socket.on('typing.updated', onTyping);

    return () => {
      socket.emit(leaveEvent, id);
      socket.off('connect', onReconnect);
      socket.off('message.created', onCreated);
      socket.off('message.updated', onUpdated);
      socket.off('message.deleted', onDeletedOrThread);
      socket.off('thread.updated', onDeletedOrThread);
      socket.off('typing.updated', onTyping);
    };
  }, [socket, kind, id, resync, applyTyping, resetTyping]);

  const send = useCallback(
    async (content: string, attachments: PendingAttachment[] = []) => {
      if (!kind || !id) return;
      const trimmed = content.trim();
      if (!trimmed && attachments.length === 0) return;
      const options = attachments.length ? { attachments } : {};
      const result =
        kind === 'channel'
          ? await sendChannelMessage(id, trimmed, options)
          : await sendConversationMessage(id, trimmed, options);
      // Sending while scrolled far back jumps to the latest.
      if (hasNewerRef.current) {
        await jumpToLatest();
        return;
      }
      setMessages((prev) => appendOrReplace(prev, result.message));
    },
    [kind, id, jumpToLatest],
  );

  const edit = useCallback(async (messageId: string, content: string) => {
    const result = await updateMessage(messageId, content);
    setMessages((prev) => replaceIfPresent(prev, result.message));
  }, []);

  const remove = useCallback(async (messageId: string) => {
    const result = await deleteMessage(messageId);
    setMessages((prev) => applyDeleted(prev, result.message));
  }, []);

  const react = useCallback(async (messageId: string, emoji: string) => {
    const result = await toggleReaction(messageId, emoji);
    setMessages((prev) => replaceIfPresent(prev, result.message));
  }, []);

  const setTypingActive = useCallback(
    (active: boolean) => {
      if (!socket || !kind || !id) return;
      socket.emit(active ? 'typing.start' : 'typing.stop', { kind, id });
    },
    [socket, kind, id],
  );

  return {
    messages,
    loading,
    error,
    hasOlder,
    hasNewer,
    loadingOlder,
    loadingNewer,
    loadOlder,
    loadNewer,
    jumpToLatest,
    latestToken,
    resync,
    typingUsers,
    send,
    edit,
    remove,
    react,
    setTyping: setTypingActive,
    reload: load,
  };
};
