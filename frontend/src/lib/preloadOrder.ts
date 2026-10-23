import type { ChatKind } from './chatCache';
import type { Channel } from '@/types/channel';
import type { Conversation } from '@/types/conversation';

type ChatRef = { kind: ChatKind; id: string };

/**
 * Which chats the preloader warms, best first: unread chats, starred
 * channels, then recent DMs and joined channels interleaved. Deduped and
 * capped at `max`.
 */
export const preloadOrder = (
  channels: Channel[],
  conversations: Conversation[],
  unread: {
    channels: Record<string, { unread: number; mentions: number }>;
    conversations: Record<string, number>;
  },
  max: number,
): ChatRef[] => {
  const joined = channels.filter((channel) => channel.isMember && channel.status === 'ACTIVE');
  const dms: ChatRef[] = conversations.map((item) => ({ kind: 'conversation', id: item.id }));
  const chans: ChatRef[] = joined.map((item) => ({ kind: 'channel', id: item.id }));

  const unreadFirst: ChatRef[] = [
    ...chans.filter((chat) => (unread.channels[chat.id]?.unread ?? 0) > 0),
    ...dms.filter((chat) => (unread.conversations[chat.id] ?? 0) > 0),
  ];
  const starred: ChatRef[] = joined
    .filter((channel) => channel.membership?.starred)
    .map((channel) => ({ kind: 'channel', id: channel.id }));
  const interleaved: ChatRef[] = [];
  for (let index = 0; index < Math.max(dms.length, chans.length); index += 1) {
    if (dms[index]) interleaved.push(dms[index]);
    if (chans[index]) interleaved.push(chans[index]);
  }

  const seen = new Set<string>();
  const result: ChatRef[] = [];
  for (const chat of [...unreadFirst, ...starred, ...interleaved]) {
    const key = `${chat.kind}:${chat.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(chat);
    if (result.length >= max) break;
  }
  return result;
};
