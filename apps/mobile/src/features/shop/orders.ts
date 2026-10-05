import { useQuery } from '@tanstack/react-query';
import { api, ApiException } from '@/core/api';
import { useSession } from '@/core/session';
import { usePollInterval } from '@/shared/hooks';
import { orderKeys, type Order } from '@/features/orders/api';
import { shopFetch, type ShopOrderInput, type ShopOrderResult } from './api';
import type { CartLine } from './cart';

export interface SubmitOutcome {
  done: { line: CartLine; result: ShopOrderResult }[];
  failed: { line: CartLine; error: string }[];
  /** Tarmoq uzilgani uchun yuborilmay qolganlar. */
  skipped: CartLine[];
}

/** ERP izohi chegarasi (`note` max 1000) — savat ro'yxati shunga sig'diriladi. */
const NOTE_MAX = 1000;

/** Savat qatorlari izoh uchun: "1) M300 beton (B-300) — 8 m³". */
export function cartNote(lines: CartLine[], baseNote?: string): string {
  const list = lines.map((l, i) => `${i + 1}) ${l.name}${l.code ? ` (${l.code})` : ''} — ${l.qty} ${l.unitLabel}`).join('; ');
  const head = lines.length > 1 ? `Savat (${lines.length} ta mahsulot): ${list}` : '';
  const full = [head, baseNote].filter(Boolean).join('. ');
  return full.length > NOTE_MAX ? `${full.slice(0, NOTE_MAX - 1)}…` : full;
}

/**
 * Savatni yuborish — BITTA ariza (`POST /api/public/shop/order`), qolgan mahsulotlar izohda ro'yxat bo'lib boradi.
 *
 * Nega bitta: ERP bitta telefondan 2 daqiqa ichida faqat bitta ariza yozadi (`lib/leads.ts`, THROTTLE_MS),
 * keyingilariga ham `ok: true` ("allaqachon qabul qilingan") qaytaradi. Ilgari har qator alohida yuborilardi —
 * 2-, 3-... mahsulotlar ERP'ga YOZILMAS, ilova esa ularni "yuborildi" deb savatdan olib tashlardi (buyurtma yo'qolardi).
 *
 * Asosiy mahsulotni server rad etsa (4xx: vitrinadan olingan, kam hajm) — u `failed`, keyingisi asosiy bo'lib
 * qayta uriniladi. Tarmoq uzilsa — to'xtaydi, qolganlari `skipped` bo'lib savatda qoladi.
 */
export async function submitCart(
  lines: CartLine[],
  base: Omit<ShopOrderInput, 'productId' | 'qty'>,
  onProgress?: (doneCount: number) => void,
): Promise<SubmitOutcome> {
  const out: SubmitOutcome = { done: [], failed: [], skipped: [] };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const rest = lines.slice(i);
    try {
      const body = { ...base, productId: line.productId, qty: line.qty, note: cartNote(rest, base.note) || undefined } satisfies ShopOrderInput;
      const result = await shopFetch<ShopOrderResult>('/order', { method: 'POST', body });
      for (const l of rest) out.done.push({ line: l, result });
      onProgress?.(out.done.length);
      break;
    } catch (e) {
      if (e instanceof ApiException) {
        out.failed.push({ line, error: e.message });
      } else {
        out.failed.push({ line, error: 'Tarmoq xatosi' });
        out.skipped.push(...lines.slice(i + 1));
        break;
      }
    }
  }
  return out;
}

/** Kirgan mijoz (ECO: Quruvchi / Tadbirkor) — hisobidagi buyurtmalar, haqiqiy holat va reyslar bilan. */
export function useClientOrders() {
  const enabled = useSession((s) => s.status === 'authed' && s.kind === 'eco' && (s.active?.role === 'QURUVCHI' || s.active?.role === 'TADBIRKOR'));
  const q = useQuery({
    queryKey: orderKeys.list({}),
    queryFn: () => api<{ items: Order[]; nextCursor: string | null }>('/orders', { query: {} }),
    enabled,
    refetchInterval: usePollInterval(enabled ? 30_000 : false),
  });
  return { ...q, enabled };
}

/** Yo'ldagi / yuklanayotgan reys holatlari — faqat shularda jonli kuzatish bor. */
export const LIVE_STATUSES = ['ACCEPTED', 'LOADING', 'EN_ROUTE', 'ARRIVED', 'UNLOADING'];
