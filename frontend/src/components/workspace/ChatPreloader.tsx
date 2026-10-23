'use client';

import { useEffect, useRef } from 'react';
import { useOrg } from '@/hooks/useOrg';
import { useChannels } from '@/hooks/useChannels';
import { useConversations } from '@/hooks/useConversations';
import { useUnread } from '@/hooks/useUnread';
import { preloadChats } from '@/lib/chatCache';
import { preloadOrder } from '@/lib/preloadOrder';

const MAX_PRELOAD = 6;
const START_DELAY_MS = 1500;

type NetworkInfo = { saveData?: boolean; effectiveType?: string };

// Data Saver / 2G: no background preloading.
const constrainedNetwork = () => {
  const connection = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  return Boolean(connection?.saveData || /2g/.test(connection?.effectiveType ?? ''));
};

const whenIdle = (run: () => void) => {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback;
  if (idle) idle(run);
  else setTimeout(run, 200);
};

// Warms the chat cache so even a first open is instant: ~1.5 s after the
// workspace loads (tab visible, browser idle) up to 6 chats are preloaded,
// unread first, 2 at a time. Lists are read through refs so list updates
// don't restart it; deps are only [organization, ready].
export const ChatPreloader = () => {
  const { active } = useOrg();
  const { channels, loading: channelsLoading } = useChannels();
  const { conversations, loading: conversationsLoading } = useConversations();
  const unread = useUnread();

  const listsRef = useRef({ channels, conversations, unread });
  useEffect(() => {
    listsRef.current = { channels, conversations, unread };
  });

  const organizationId = active?.id ?? null;
  const ready = Boolean(organizationId) && !channelsLoading && !conversationsLoading;

  useEffect(() => {
    if (!ready || constrainedNetwork()) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const start = () => {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') {
        document.addEventListener('visibilitychange', onVisible);
        return;
      }
      whenIdle(() => {
        if (cancelled) return;
        const lists = listsRef.current;
        const chats = preloadOrder(lists.channels, lists.conversations, lists.unread, MAX_PRELOAD);
        void preloadChats(chats, () => cancelled);
      });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', onVisible);
        start();
      }
    };

    timer = setTimeout(start, START_DELAY_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [organizationId, ready]);

  return null;
};
