import { io, Socket } from 'socket.io-client';
import { resolveServerUrl } from './serverUrl';
import { apiData } from './api';

const SOCKET_URL = resolveServerUrl(process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:5000');

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      // Called before every (re)connect. In production the API cookie lives on
      // the frontend's domain (Vercel proxies /api), so the socket - which goes
      // straight to the API host - proves the session with a fresh
      // short-lived ticket. Locally the cookie also works; the ticket is harmless.
      auth: (send) => {
        apiData<{ ticket: string }>('/auth/socket-ticket')
          .then(({ ticket }) => send({ ticket }))
          .catch(() => send({}));
      },
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
