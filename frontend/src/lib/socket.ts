import { io, Socket } from 'socket.io-client';
import { resolveServerUrl } from './serverUrl';

const SOCKET_URL = resolveServerUrl(process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:5000');

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
    });
  }
  return socket;
};

// The server binds a socket to the session's active org at handshake, so
// switching workspace needs a fresh connection. Room-joining hooks rejoin on
// 'connect'.
export const reconnectSocket = (): void => {
  if (!socket) {
    return;
  }
  socket.disconnect();
  socket.connect();
};

export const disconnectSocket = (): void => {
  socket?.disconnect();
  socket = null;
};
