import { kv } from './storage';
import { api, ApiException, uuid } from './api';

/**
 * Offline outbox (ADR-0006): yozuvchi so'rovlar lokal navbatga tushadi, FIFO yuboriladi.
 * Har element ID = Idempotency-Key → server takrorni oldini oladi.
 */
export interface OutboxItem { id: string; path: string; method: 'POST' | 'PUT'; body: unknown; createdAt: number; attempts: number; lastError?: string }

const KEY = 'outbox.v1';
const read = (): OutboxItem[] => { try { return JSON.parse(kv.getString(KEY) ?? '[]'); } catch { return []; } };
const write = (items: OutboxItem[]) => kv.set(KEY, JSON.stringify(items));

const listeners = new Set<() => void>();
export const onOutboxChange = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => listeners.forEach((f) => f());

export const outbox = {
  list: read,
  size: () => read().length,

  enqueue(path: string, body: unknown, method: 'POST' | 'PUT' = 'POST'): OutboxItem {
    const item: OutboxItem = { id: uuid(), path, method, body, createdAt: Date.now(), attempts: 0 };
    write([...read(), item]);
    notify();
    void outbox.flush();
    return item;
  },

  flushing: false,
  /** Tartibda yuboradi; 4xx (409 dan tashqari) — o'chiriladi va xato saqlanadi; tarmoq xatosi — to'xtaydi. */
  async flush() {
    if (outbox.flushing) return;
    outbox.flushing = true;
    try {
      let items = read();
      while (items.length > 0) {
        const item = items[0]!;
        try {
          await api(item.path, { method: item.method, body: item.body, idempotencyKey: item.id });
          items = items.slice(1);
          write(items);
          notify();
        } catch (e) {
          if (e instanceof ApiException) {
            // Server rad etdi (masalan, holat allaqachon oldinga o'tgan) — element tashlab yuboriladi, UI serverdan yangilanadi
            items = items.slice(1);
            write(items);
            notify();
            continue;
          }
          // tarmoq yo'q — keyinroq
          item.attempts += 1;
          item.lastError = String(e);
          write(items);
          notify();
          break;
        }
      }
    } finally {
      outbox.flushing = false;
    }
  },
};
