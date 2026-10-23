'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { useChannels } from './useChannels';
import { useConversations } from './useConversations';
import { useOrg } from './useOrg';
import { listConversationCandidates } from '@/lib/conversations';
import { loadRecentChats } from '@/lib/recentChats';
import type { Conversation } from '@/types/conversation';
import type { User } from '@/types/user';

export type SwitcherItem = {
  key: string;
  group: 'Recent' | 'Channels' | 'Direct messages' | 'People';
  label: string;
  hint?: string;
  icon: 'hash' | 'lock' | 'message' | 'users';
  user?: User;
  /** Chat route; people without a DM yet have none (a DM is created). */
  href?: string;
  userId?: string;
};

const MAX_PER_GROUP = 6;

const dmTitle = (conversation: Conversation, myId?: string) =>
  conversation.participants
    .filter((participant) => participant.user.id !== myId)
    .map((participant) => participant.user.fullName)
    .join(', ') || 'Direct message';

/** Channels, DMs, people and recents for the Ctrl/Cmd+K switcher. */
export const useQuickSwitcherItems = (open: boolean, query: string) => {
  const { user } = useAuth();
  const { active } = useOrg();
  const { channels } = useChannels();
  const { conversations } = useConversations();
  const [people, setPeople] = useState<User[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !active?.id) {
      return;
    }
    setRecent(loadRecentChats(active.id));
    let cancelled = false;
    listConversationCandidates()
      .then((result) => {
        if (!cancelled) setPeople(result.candidates.map((candidate) => candidate.user));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, active?.id]);

  return useMemo(() => {
    const term = query.trim().toLowerCase().replace(/^[#@]/, '');
    const match = (text: string) => !term || text.toLowerCase().includes(term);

    const channelItems: SwitcherItem[] = channels
      .filter((channel) => channel.status === 'ACTIVE' && match(channel.name))
      .sort((a, b) => Number(b.isMember) - Number(a.isMember))
      .map((channel) => ({
        key: `channel:${channel.id}`,
        group: 'Channels',
        label: channel.name,
        hint: channel.isMember ? undefined : 'Not joined',
        icon: channel.type === 'PRIVATE' ? 'lock' : 'hash',
        href: `/channels/${channel.id}`,
      }));

    const directUserIds = new Set<string>();
    const dmItems: SwitcherItem[] = conversations
      .map((conversation) => {
        const others = conversation.participants.filter((p) => p.user.id !== user?.id);
        if (conversation.type === 'DIRECT' && others[0]) directUserIds.add(others[0].user.id);
        return {
          key: `dm:${conversation.id}`,
          group: 'Direct messages' as const,
          label: dmTitle(conversation, user?.id),
          icon: 'message' as const,
          user: others.length === 1 ? others[0].user : undefined,
          href: `/dm/${conversation.id}`,
        };
      })
      .filter((item) => match(item.label));

    const peopleItems: SwitcherItem[] = people
      .filter((person) => !directUserIds.has(person.id) && match(person.fullName))
      .map((person) => ({
        key: `person:${person.id}`,
        group: 'People',
        label: person.fullName,
        hint: person.jobTitle || undefined,
        icon: 'users',
        user: person,
        userId: person.id,
      }));

    const byKey = new Map([...channelItems, ...dmItems].map((item) => [item.key, item]));
    const recentItems: SwitcherItem[] = term
      ? []
      : recent
          .map((key) => byKey.get(key))
          .filter((item): item is SwitcherItem => Boolean(item))
          .map((item) => ({ ...item, key: `recent:${item.key}`, group: 'Recent' }));

    return [
      ...recentItems.slice(0, MAX_PER_GROUP),
      ...channelItems.slice(0, MAX_PER_GROUP),
      ...dmItems.slice(0, MAX_PER_GROUP),
      ...peopleItems.slice(0, MAX_PER_GROUP),
    ];
  }, [channels, conversations, people, recent, query, user?.id]);
};
