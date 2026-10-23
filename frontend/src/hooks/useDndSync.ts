'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';

/** Applies `dnd.updated` (other tabs / expiry) to the signed-in user. */
export const useDndSync = () => {
  const { socket } = useSocket();
  const { user, setUser } = useAuth();

  useEffect(() => {
    if (!socket || !user) {
      return;
    }
    const onUpdated = (payload: { dndUntil?: string | null }) => {
      setUser({ ...user, dndUntil: payload?.dndUntil ?? null });
    };
    socket.on('dnd.updated', onUpdated);
    return () => {
      socket.off('dnd.updated', onUpdated);
    };
  }, [socket, user, setUser]);
};
