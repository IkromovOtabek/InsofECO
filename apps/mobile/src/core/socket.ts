import { io, Socket } from 'socket.io-client';
import { config } from './config';
import { KEYS, secure } from './storage';

let socket: Socket | null = null;

/** WS /tracking — bitta ulanish, lazy. Token handshake'da. */
export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  const token = await secure.get(KEYS.access);
  socket?.disconnect();
  socket = io(`${config.apiUrl}/tracking`, { auth: { token }, transports: ['websocket'], reconnection: true, reconnectionDelay: 2000 });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
