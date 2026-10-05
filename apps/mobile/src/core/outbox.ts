import { kv } from './storage';
import { api, ApiException, uuid } from './api';
import { useSession } from './session';
import { toast } from '@/design/ui';

/**
 * Offline outbox (ADR-0006): yozuvchi so'rovlar lokal navbatga tushadi, FIFO yuboriladi.
 * Har element ID = Idempotency-Key → server takrorni oldini oladi (ilova yuborish bilan
 * o'chirish orasida o'ldirilsa ham — qayta yuborilganda server takror deb taniydi).
 *
 * `owner` — kim va qaysi tashkilot nomidan navbatga qo'yilgan (`userId:orgId`). Telefonda boshqa
 * hisob yoki boshqa tashkilot faol bo'lsa element YUBORILMAYDI: aks holda bir hisobning amali
 * boshqasining tokeni va X-Org-Id bilan ketardi. Egasi qaytganda yuboriladi; TTL dan keyin tashlanadi.
 */
export interface OutboxItem { id: string; path: string; method: 'POST' | 'PUT'; body: unknown; createdAt: number; attempts: number; lastError?: string; owner?: string }

const KEY = 'outbox.v1';
/** Egasi shuncha vaqt qaytmagan element tashlanadi — eski holat o'tishi kunlar o'tib serverga tushmasin. */
const TTL_MS = 3 * 24 * 3600_000;
const read = (): OutboxItem[] => { try { const v = JSON.parse(kv.getString(KEY) ?? '[]') as unknown; return Array.isArray(v) ? (v as OutboxItem[]) : []; } catch { return []; } };
const write = (items: OutboxItem[]) => kv.set(KEY, JSON.stringify(items));

const listeners = new Set<() => void>();
export const onOutboxChange = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => listeners.forEach((f) => f());

/**
 * Elementni JORIY saqlangan ro'yxatda o'zgartirish. Yuborish davomida `enqueue` yangi element
 * qo'shishi mumkin — eski nusxani yozib yuborsak u yo'qolardi.
 */
const patch = (id: string, fn: (i: OutboxItem) => OutboxItem | null) => {
  write(read().flatMap((i) => { if (i.id !== id) return [i]; const n = fn(i); return n ? [n] : []; }));
  notify();
};

/** Hozirgi ECO hisobi va tashkiloti; kirilmagan bo'lsa `null` — navbat kutadi. */
const currentOwner = (): string | null => {
  const s = useSession.getState();
  return s.status === 'authed' && s.kind === 'eco' && s.user && s.active ? `${s.user.id}:${s.active.organization.id}` : null;
};

/**
 * Qayta urinsa bo'ladigan javoblar: server vaqtincha ishlamayapti (5xx), vaqt tugadi (408),
 * cheklov (429), sessiya tugagan (401 — qayta kirilgach yuboriladi). Boshqa 4xx — server
 * amalni rad etdi, qayta yuborish foydasiz.
 */
const retryable = (status: number) => status >= 500 || status === 401 || status === 408 || status === 429;
/** 5 s, 10 s, 20 s ... eng ko'pi 5 daqiqa. */
const backoffMs = (attempts: number) => Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 5 * 60_000);

let retryTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleRetry = (attempts: number) => {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { retryTimer = null; void outbox.flush(); }, backoffMs(attempts));
};

export const outbox = {
  list: read,
  size: () => read().length,

  enqueue(path: string, body: unknown, method: 'POST' | 'PUT' = 'POST'): OutboxItem {
    const item: OutboxItem = { id: uuid(), path, method, body, createdAt: Date.now(), attempts: 0, owner: currentOwner() ?? undefined };
    write([...read(), item]);
    notify();
    void outbox.flush();
    return item;
  },

  flushing: false,
  /**
   * Tartibda yuboradi (faqat joriy egasining elementlari). Server rad etsa (4xx) — element
   * tashlanadi va foydalanuvchiga aytiladi; tarmoq/5xx/401 — to'xtaydi va backoff bilan qayta uriniladi.
   */
  async flush() {
    if (outbox.flushing) return;
    const owner = currentOwner();
    if (!owner) return;
    outbox.flushing = true;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    try {
      const now = Date.now();
      const all = read();
      const fresh = all.filter((i) => now - i.createdAt < TTL_MS);
      if (fresh.length !== all.length) { write(fresh); notify(); }
      for (;;) {
        // Egasi yozilmagan eski elementlar (oldingi versiya) joriy hisobniki deb olinadi
        const item = read().find((i) => (i.owner ?? owner) === owner);
        if (!item) break;
        try {
          await api(item.path, { method: item.method, body: item.body, idempotencyKey: item.id });
          patch(item.id, () => null);
        } catch (e) {
          if (e instanceof ApiException && !retryable(e.status)) {
            // Server rad etdi (masalan, holat allaqachon oldinga o'tgan) — element tashlanadi, UI serverdan yangilanadi
            patch(item.id, () => null);
            toast.warning(e.message || 'Amal server tomonidan qabul qilinmadi', "Navbatdagi o'zgarish bekor qilindi");
            continue;
          }
          // tarmoq yo'q / server vaqtincha ishlamayapti — keyinroq
          const attempts = item.attempts + 1;
          patch(item.id, (i) => ({ ...i, attempts, lastError: String(e) }));
          scheduleRetry(attempts);
          break;
        }
      }
    } finally {
      outbox.flushing = false;
    }
  },
};
