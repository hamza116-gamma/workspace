'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type TypingPayload = {
  kind: string;
  id: string;
  user: { id: string; fullName: string };
  typing: boolean;
};

// A typing entry expires on its own if no typing=false ever arrives.
const TYPING_EXPIRY_MS = 7000;

export const useTypingUsers = (selfId: string | undefined) => {
  const [typing, setTyping] = useState<Record<string, string>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const drop = useCallback((userId: string) => {
    const timer = timers.current.get(userId);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(userId);
    }
    setTyping((prev) => {
      if (!(userId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  const apply = useCallback(
    (payload: TypingPayload) => {
      if (selfId && payload.user.id === selfId) {
        return;
      }
      if (!payload.typing) {
        drop(payload.user.id);
        return;
      }
      clearTimeout(timers.current.get(payload.user.id));
      timers.current.set(
        payload.user.id,
        setTimeout(() => drop(payload.user.id), TYPING_EXPIRY_MS),
      );
      setTyping((prev) =>
        prev[payload.user.id] === payload.user.fullName
          ? prev
          : { ...prev, [payload.user.id]: payload.user.fullName },
      );
    },
    [selfId, drop],
  );

  const reset = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setTyping({});
  }, []);

  useEffect(() => reset, [reset]);

  return { typingUsers: Object.values(typing), applyTyping: apply, resetTyping: reset };
};
