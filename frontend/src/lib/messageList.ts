import type { Message } from '@/types/message';

// Pure helpers for the loaded message window (useMessages).

export const PAGE_SIZE = 30; // = server default page size

export const isMainListMessage = (message: Message) =>
  !message.parentMessageId || message.alsoSentToChannel;

// A deleted ROOT that still has replies stays as a placeholder.
export const isPlaceholderWorthy = (message: Message) =>
  !message.deletedAt || (!message.parentMessageId && message.replyCount > 0);

export const replaceIfPresent = (list: Message[], message: Message): Message[] => {
  const index = list.findIndex((item) => item.id === message.id);
  if (index === -1) {
    return list;
  }
  const next = [...list];
  next[index] = message;
  return next;
};

export const appendOrReplace = (list: Message[], message: Message): Message[] =>
  list.some((item) => item.id === message.id)
    ? replaceIfPresent(list, message)
    : [...list, message];

// Merges the latest page into the loaded history after a reconnect. When the
// page does not overlap what is loaded (we missed more than a page), the
// history is replaced by the page.
export const mergeLatestPage = (
  loaded: Message[],
  page: Message[],
): { messages: Message[]; replaced: boolean } => {
  if (page.length === 0) {
    return { messages: [], replaced: true };
  }
  const oldestInPage = page[0].id;
  const overlaps = loaded.some((item) => item.id >= oldestInPage);
  if (!overlaps && loaded.length > 0 && page.length >= PAGE_SIZE) {
    return { messages: page, replaced: true };
  }
  const older = loaded.filter((item) => item.id < oldestInPage);
  return { messages: [...older, ...page], replaced: false };
};

// Slack-style bounded window: at most MAX_LOADED messages are loaded.
export const MAX_LOADED = 200;

// Deleted messages stay only as root placeholders (with replies).
export const applyDeleted = (list: Message[], message: Message) =>
  isPlaceholderWorthy(message)
    ? replaceIfPresent(list, message)
    : list.filter((item) => item.id !== message.id);

/** Older page prepended: drops the newest past the cap (-> hasNewer). */
export const prependPage = (list: Message[], older: Message[]) => {
  const known = new Set(list.map((item) => item.id));
  const next = [...older.filter((item) => !known.has(item.id)), ...list];
  const trimmed = next.length > MAX_LOADED;
  return { messages: trimmed ? next.slice(0, MAX_LOADED) : next, trimmed };
};

/** Newer page appended: drops the oldest past the cap (-> hasOlder). */
export const appendPage = (list: Message[], newer: Message[]) => {
  const known = new Set(list.map((item) => item.id));
  const next = [...list, ...newer.filter((item) => !known.has(item.id))];
  const trimmed = next.length > MAX_LOADED;
  return { messages: trimmed ? next.slice(next.length - MAX_LOADED) : next, trimmed };
};
