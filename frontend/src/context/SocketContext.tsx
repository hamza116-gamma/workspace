'use client';

import { createContext, useEffect, useMemo, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuth } from '@/hooks/useAuth';

type SocketValue = {
  socket: Socket | null;
  connected: boolean;
  everConnected: boolean;
};

export const SocketContext = createContext<SocketValue | null>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [everConnected, setEverConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
      setEverConnected(false);
      return;
    }

    const instance = getSocket();

    const onConnect = () => {
      setConnected(true);
      setEverConnected(true);
    };
    const onDisconnect = (reason: Socket.DisconnectReason) => {
      setConnected(false);
      // The server drops sockets on org switch so they re-authorize under the
      // new org; socket.io does not auto-reconnect after a server disconnect.
      if (reason === 'io server disconnect') {
        instance.connect();
      }
    };

    instance.on('connect', onConnect);
    instance.on('disconnect', onDisconnect);
    instance.connect();
    setSocket(instance);

    return () => {
      instance.off('connect', onConnect);
      instance.off('disconnect', onDisconnect);
    };
  }, [user]);

  const value = useMemo<SocketValue>(
    () => ({ socket, connected, everConnected }),
    [socket, connected, everConnected],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
