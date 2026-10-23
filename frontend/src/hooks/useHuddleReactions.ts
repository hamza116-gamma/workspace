'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';

// Must match the backend set (sockets/huddle.sockets.js REACTIONS).
export const HUDDLE_REACTIONS = ['👍', '❤️', '😂', '🎉', '👏', '😮', '🙌', '🔥'];

export type FloatingReaction = { id: string; emoji: string; name: string; left: number };

type ReactionEvent = { huddleId: string; id: string; emoji: string; user: { fullName: string } };

const LIFETIME_MS = 2600;
const THROTTLE_MS = 400;

// Live huddle reactions (huddle:react -> huddle:reaction, huddle room only).
export const useHuddleReactions = (huddleId: string | null) => {
  const { socket } = useSocket();
  const [items, setItems] = useState<FloatingReaction[]>([]);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!socket || !huddleId) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const onReaction = (event: ReactionEvent) => {
      if (event.huddleId !== huddleId) return;
      const item = {
        id: event.id,
        emoji: event.emoji,
        name: event.user.fullName.split(' ')[0],
        left: 10 + Math.random() * 70,
      };
      setItems((prev) => [...prev.slice(-11), item]);
      timers.push(
        setTimeout(() => setItems((prev) => prev.filter((r) => r.id !== item.id)), LIFETIME_MS),
      );
    };
    socket.on('huddle:reaction', onReaction);
    return () => {
      socket.off('huddle:reaction', onReaction);
      timers.forEach(clearTimeout);
    };
  }, [socket, huddleId]);

  const send = useCallback(
    (emoji: string) => {
      const now = Date.now();
      if (!socket || !huddleId || now - lastSent.current < THROTTLE_MS) return;
      lastSent.current = now;
      socket.emit('huddle:react', { huddleId, emoji });
    },
    [socket, huddleId],
  );

  return { items, send };
};
