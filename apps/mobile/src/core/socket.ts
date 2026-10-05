import { io, Socket } from 'socket.io-client';
import { config } from './config';
import { KEYS, secure } from './storage';

let socket: Socket | null = null;

/**
 * WS /tracking — bitta ulanish, lazy.
 *
 * Token har ulanish urinishida YANGIDAN o'qiladi (`auth` funksiya): aks holda access token
 * eskirgach (refresh uni almashtirgan) qayta ulanishlar abadiy 401 bilan rad etilardi.
 * Mavjud soket qayta ulanayotgan bo'lsa ham o'sha qaytariladi — uni uzib yangisini ochish
 * boshqa ekranlar ulagan tinglovchilarni o'ldirardi. Ulanish sinxron yaratiladi, shuning uchun
 * bir vaqtdagi ikki chaqiruv ikkita soket ochmaydi.
 */
export async function getSocket(): Promise<Socket> {
  if (socket) return socket;
  socket = io(`${config.apiUrl}/tracking`, {
    auth: (cb) => { void secure.get(KEYS.access).then((token) => cb({ token }), () => cb({})); },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30_000,
    randomizationFactor: 0.5,
  });
  return socket;
}

/** Chiqishda / hisob almashganda — eski token bilan ulanish qolib ketmasin. */
export function closeSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
