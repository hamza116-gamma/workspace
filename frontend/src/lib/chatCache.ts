import { ApiError } from './api';
import { cacheGeneration, drop, fetchShared, isStaleGeneration, peek, put } from './cache';
import { getChannel } from './channels';
import { getConversation } from './conversations';
import { listChannelMessages, listConversationMessages } from './messages';
import {
  PAGE_SIZE,
  appendOrReplace,
  applyDeleted,
  isMainListMessage,
  mergeLatestPage,
  replaceIfPresent,
} from './messageList';
import type { Channel } from '@/types/channel';
import type { Conversation } from '@/types/conversation';
import type { Message } from '@/types/message';

// Per-chat memory cache: the latest message window, header details and the
// reader's scroll position. Revisiting a chat renders from here instantly,
// then refreshes in the background (stale-while-revalidate).

export type ChatKind = 'channel' | 'conversation';

/** Only the latest CACHE_KEEP messages per chat are kept in memory. */
export const CACHE_KEEP = 60;
/** At most this many chats are cached (least recently used evicted). */
const MAX_CHATS = 40;

export type ChatSnapshot = { messages: Message[]; hasOlder: boolean };
/** Pinned message + offset from the top of the list; null = at the bottom. */
export type ScrollAnchor = { messageId: string; offset: number } | null;

export const chatKeyOf = (kind: ChatKind, id: string) => `${kind}:${id}`;
const messagesKey = (chat: string) => `messages:${chat}`;
const scrollKey = (chat: string) => `scroll:${chat}`;
const PER_CHAT_PREFIXES = [
  'messages:',
  'scroll:',
  'files:',
  'links:',
  'members:',
  'pins:',
  'fetch:latest:',
  'fetch:',
  '',
];

// LRU order of chats with cached data (most recent last).
const recent: string[] = [];

const touch = (chat: string) => {
  const index = recent.indexOf(chat);
  if (index !== -1) recent.splice(index, 1);
  recent.push(chat);
  while (recent.length > MAX_CHATS) {
    const evicted = recent.shift();
    if (evicted) PER_CHAT_PREFIXES.forEach((prefix) => drop(`${prefix}${evicted}`));
  }
};

/** Forget everything cached for a chat (no access any more, deleted, ...). */
export const dropChat = (kind: ChatKind, id: string) => {
  const chat = chatKeyOf(kind, id);
  PER_CHAT_PREFIXES.forEach((prefix) => drop(`${prefix}${chat}`));
  const index = recent.indexOf(chat);
  if (index !== -1) recent.splice(index, 1);
};

/** 403 / 404: the chat is gone or no longer accessible. */
export const isAccessLost = (error: unknown) =>
  error instanceof ApiError && (error.status === 403 || error.status === 404);

// ---- message window ------------------------------------------------------

export const getChatSnapshot = (kind: ChatKind, id: string) => {
  const chat = chatKeyOf(kind, id);
  const snapshot = peek<ChatSnapshot>(messagesKey(chat));
  if (snapshot) touch(chat);
  return snapshot;
};

/** Stores the latest window (callers never pass a scrolled-back window). */
export const saveChatSnapshot = (
  kind: ChatKind,
  id: string,
  messages: Message[],
  hasOlder: boolean,
) => {
  const chat = chatKeyOf(kind, id);
  const trimmed = messages.length > CACHE_KEEP;
  put<ChatSnapshot>(messagesKey(chat), {
    messages: trimmed ? messages.slice(messages.length - CACHE_KEEP) : messages,
    hasOlder: hasOlder || trimmed,
  });
  touch(chat);
};

export const getChatScroll = (kind: ChatKind, id: string): ScrollAnchor =>
  peek<ScrollAnchor>(scrollKey(chatKeyOf(kind, id))) ?? null;

export const saveChatScroll = (kind: ChatKind, id: string, anchor: ScrollAnchor) =>
  put(scrollKey(chatKeyOf(kind, id)), anchor);

/** MessageList scrollMemory (keys are `<kind>:<id>`). */
export const chatScrollMemory = {
  get: (chat: string): ScrollAnchor => peek<ScrollAnchor>(scrollKey(chat)) ?? null,
  save: (chat: string, anchor: ScrollAnchor) => put(scrollKey(chat), anchor),
};

const listPage = (kind: ChatKind, id: string) =>
  kind === 'channel' ? listChannelMessages(id) : listConversationMessages(id);

/** Latest page, deduped with any identical request already running. */
export const fetchLatestMessages = (kind: ChatKind, id: string) =>
  fetchShared(`fetch:latest:${chatKeyOf(kind, id)}`, () =>
    listPage(kind, id).then((result) => result.messages.filter(isMainListMessage)),
  );

/** Merges a fresh latest page into the cached window (or starts one). */
export const mergeLatest = (kind: ChatKind, id: string, page: Message[]) => {
  const cached = getChatSnapshot(kind, id);
  if (!cached) {
    saveChatSnapshot(kind, id, page, page.length >= PAGE_SIZE);
    return;
  }
  const merged = mergeLatestPage(cached.messages, page);
  saveChatSnapshot(
    kind,
    id,
    merged.messages,
    merged.replaced ? page.length >= PAGE_SIZE : cached.hasOlder,
  );
};

/** Background refresh of a cached chat that is not on screen. */
export const refreshCachedChat = async (kind: ChatKind, id: string) => {
  if (!getChatSnapshot(kind, id)) return;
  const generation = cacheGeneration();
  try {
    const page = await fetchLatestMessages(kind, id);
    if (!isStaleGeneration(generation)) mergeLatest(kind, id, page);
  } catch (error) {
    if (isAccessLost(error)) dropChat(kind, id);
  }
};

type LiveChange = 'created' | 'updated' | 'deleted';

/** Keeps a cached (not necessarily open) chat current from socket events. */
export const applyLiveMessage = (change: LiveChange, message: Message) => {
  const kind: ChatKind | null = message.channelId
    ? 'channel'
    : message.conversationId
      ? 'conversation'
      : null;
  const id = message.channelId ?? message.conversationId;
  if (!kind || !id) return;
  const cached = peek<ChatSnapshot>(messagesKey(chatKeyOf(kind, id)));
  if (!cached) return;
  let next = cached.messages;
  if (change === 'created') {
    if (!isMainListMessage(message)) return;
    next = appendOrReplace(next, message);
  } else if (change === 'updated') {
    next = replaceIfPresent(next, message);
  } else {
    next = applyDeleted(next, message);
  }
  if (next !== cached.messages) saveChatSnapshot(kind, id, next, cached.hasOlder);
};

// ---- header details --------------------------------------------------------

export const peekChannel = (id: string) => peek<Channel>(chatKeyOf('channel', id));
export const peekConversation = (id: string) => peek<Conversation>(chatKeyOf('conversation', id));

export const putChannel = (channel: Channel) => {
  put(chatKeyOf('channel', channel.id), channel);
  touch(chatKeyOf('channel', channel.id));
};

export const putConversation = (conversation: Conversation) => {
  put(chatKeyOf('conversation', conversation.id), conversation);
  touch(chatKeyOf('conversation', conversation.id));
};

export const fetchChannelDetails = (id: string) =>
  fetchShared(`fetch:${chatKeyOf('channel', id)}`, () => {
    const generation = cacheGeneration();
    return getChannel(id).then((result) => {
      if (!isStaleGeneration(generation)) putChannel(result.channel);
      return result.channel;
    });
  });

export const fetchConversationDetails = (id: string) =>
  fetchShared(`fetch:${chatKeyOf('conversation', id)}`, () => {
    const generation = cacheGeneration();
    return getConversation(id).then((result) => {
      if (!isStaleGeneration(generation)) putConversation(result.conversation);
      return result.conversation;
    });
  });

// ---- prefetch / preload ------------------------------------------------------

/** Loads a chat's header + latest messages into memory (sidebar hover, preloader). */
export const prefetchChat = async (kind: ChatKind, id: string) => {
  const hasDetails = kind === 'channel' ? peekChannel(id) : peekConversation(id);
  const hasMessages = getChatSnapshot(kind, id);
  const generation = cacheGeneration();
  try {
    await Promise.all([
      hasDetails
        ? null
        : kind === 'channel'
          ? fetchChannelDetails(id)
          : fetchConversationDetails(id),
      hasMessages
        ? null
        : fetchLatestMessages(kind, id).then((page) => {
            if (!isStaleGeneration(generation)) mergeLatest(kind, id, page);
          }),
    ]);
  } catch (error) {
    if (isAccessLost(error)) dropChat(kind, id);
  }
};

/** Preloads chats two at a time; stops early when `shouldStop` says so. */
export const preloadChats = async (
  chats: { kind: ChatKind; id: string }[],
  shouldStop: () => boolean = () => false,
) => {
  for (let index = 0; index < chats.length; index += 2) {
    if (shouldStop()) return;
    await Promise.all(
      chats.slice(index, index + 2).map((chat) => prefetchChat(chat.kind, chat.id)),
    );
  }
};
