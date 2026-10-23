'use client';

import { createContext, useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import type { PresenceState } from '@/types/user';

type PresenceUpdated = { userId: string; presence: PresenceState };

export type PresenceMap = Record<string, PresenceState>;

// Presence lives apart from SocketContext so socket consumers do not
// re-render on every presence change.
export const PresenceContext = createContext<PresenceMap | null>(null);

export const PresenceProvider = ({ children }: { children: React.ReactNode }) => {
  const { socket } = useSocket();
  const [presence, setPresence] = useState<PresenceMap>({});

  useEffect(() => {
    if (!socket) {
      setPresence({});
      return;
    }
    const onPresence = (payload: PresenceUpdated) =>
      setPresence((current) =>
        current[payload.userId] === payload.presence
          ? current
          : { ...current, [payload.userId]: payload.presence },
      );
    socket.on('presence.updated', onPresence);
    return () => {
      socket.off('presence.updated', onPresence);
    };
  }, [socket]);

  return <PresenceContext.Provider value={presence}>{children}</PresenceContext.Provider>;
};
