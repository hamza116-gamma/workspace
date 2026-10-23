'use client';

import { useEffect, useState } from 'react';
import { listChannelMembers } from '@/lib/channels';
import { fetchShared, peek } from '@/lib/cache';
import { fetchConversationDetails, peekConversation } from '@/lib/chatCache';
import type { Conversation } from '@/types/conversation';
import type { User } from '@/types/user';

export type MentionTarget = { kind: 'channel' | 'conversation'; id: string } | null;

export const useMentionables = (target: MentionTarget) => {
  const [users, setUsers] = useState<User[]>([]);

  const kind = target?.kind ?? null;
  const id = target?.id ?? null;

  useEffect(() => {
    if (!kind || !id) {
      setUsers([]);
      return;
    }
    let active = true;

    // Cached per chat; DMs reuse the shared conversation details.
    const fromConversation = (conversation: Conversation) =>
      conversation.participants.map((participant) => participant.user);
    const membersKey = `members:channel:${id}`;
    const cachedConversation = kind === 'conversation' ? peekConversation(id) : undefined;
    const cached =
      kind === 'channel'
        ? peek<User[]>(membersKey)
        : cachedConversation && fromConversation(cachedConversation);
    setUsers(cached ?? []);

    const load =
      kind === 'channel'
        ? fetchShared(membersKey, () =>
            listChannelMembers(id).then((result) => result.members.map((member) => member.user)),
          )
        : fetchConversationDetails(id).then(fromConversation);

    load
      .then((list) => {
        if (active) {
          setUsers(list);
        }
      })
      .catch(() => {
        if (active && !cached) {
          setUsers([]);
        }
      });

    return () => {
      active = false;
    };
  }, [kind, id]);

  return users;
};
