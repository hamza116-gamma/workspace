'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type TypingPayload = {
  kind: string;
  id: string;
  user: { id: string; fullName: string };
  typing: boolean;
  // What they are doing in the composer (absent = typing, older servers).
  activity?: ComposerActivity;
};

export type ComposerActivity = 'typing' | 'recording';
type Entry = { name: string; activity: ComposerActivity };

// A typing entry expires on its own if no typing=false ever arrives.
const TYPING_EXPIRY_MS = 7000;

export const useTypingUsers = (selfId: string | undefined) => {
  const [typing, setTyping] = useState<Record<string, Entry>>({});
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
      const activity = payload.activity ?? 'typing';
      setTyping((prev) =>
        prev[payload.user.id]?.name === payload.user.fullName &&
        prev[payload.user.id]?.activity === activity
          ? prev
          : { ...prev, [payload.user.id]: { name: payload.user.fullName, activity } },
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

  const entries = Object.values(typing);
  return {
    typingUsers: entries.filter((entry) => entry.activity === 'typing').map((entry) => entry.name),
    recordingUsers: entries
      .filter((entry) => entry.activity === 'recording')
      .map((entry) => entry.name),
    applyTyping: apply,
    resetTyping: reset,
  };
};
