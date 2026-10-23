'use client';

import { useEffect, useMemo } from 'react';
import { useUnread } from '@/hooks/useUnread';
import { useMutedTargets } from '@/hooks/useMutedTargets';

// "(3) Title" -> "Title"; "* Title" -> "Title".
const PREFIX_RE = /^(\(\d+\+?\) |\* )/;

const decorate = (badge: string) => {
  const base = document.title.replace(PREFIX_RE, '');
  const next = badge ? `${badge} ${base}` : base;
  if (document.title !== next) {
    document.title = next;
  }
};

/**
 * Browser tab badge (Slack): "(N) <title>" for mentions + unread DMs,
 * "* <title>" for other unread. Re-applied whenever Next.js rewrites the
 * <title> on navigation.
 */
export const TabTitle = () => {
  const { channels, conversations } = useUnread();
  const muted = useMutedTargets();

  const badge = useMemo(() => {
    let important = 0;
    let other = 0;
    // Muted chats are left out (mentions still count).
    Object.entries(channels).forEach(([id, item]) => {
      important += item.mentions;
      if (!muted.channelIds.has(id)) other += item.unread;
    });
    Object.entries(conversations).forEach(([id, count]) => {
      if (!muted.conversationIds.has(id)) important += count;
    });
    if (important > 0) {
      return `(${important > 99 ? '99+' : important})`;
    }
    return other > 0 ? '*' : '';
  }, [channels, conversations, muted]);

  useEffect(() => {
    decorate(badge);
    const head = document.querySelector('head');
    if (!head) {
      return;
    }
    const observer = new MutationObserver(() => decorate(badge));
    observer.observe(head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      decorate('');
    };
  }, [badge]);

  return null;
};
