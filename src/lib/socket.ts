import { io } from 'socket.io-client';

const socketUrl = import.meta.env.DEV
  ? (import.meta.env.VITE_SOCKET_SERVER_URL ?? 'http://127.0.0.1:3001')
  : undefined;

export const socket = io(socketUrl, {
  autoConnect: false,
});

export function ensureSocketConnected() {
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}
