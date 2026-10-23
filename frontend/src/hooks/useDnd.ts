'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { updateDnd, type DndUpdate } from '@/lib/users';
import { isDndActive } from '@/lib/dnd';

/** Do Not Disturb state of the signed-in user + pause/resume actions. */
export const useDnd = () => {
  const { user, setUser } = useAuth();
  const dndUntil = user?.dndUntil ?? null;
  const [, setTick] = useState(0);

  // Re-render when the pause ends so the indicator disappears on time.
  useEffect(() => {
    if (!dndUntil) {
      return;
    }
    const delay = new Date(dndUntil).getTime() - Date.now();
    if (delay <= 0 || delay > 2 ** 31 - 1) {
      return;
    }
    const timer = setTimeout(() => setTick((value) => value + 1), delay + 250);
    return () => clearTimeout(timer);
  }, [dndUntil]);

  const apply = useCallback(
    async (update: DndUpdate) => {
      const result = await updateDnd(update);
      setUser(result.user);
    },
    [setUser],
  );

  const active = isDndActive(user);
  return {
    active,
    dndUntil: active ? dndUntil : null,
    pause: apply,
    resume: useCallback(() => apply({ off: true }), [apply]),
  };
};
