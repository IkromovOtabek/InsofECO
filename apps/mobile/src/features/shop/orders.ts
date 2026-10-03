import { useQuery } from '@tanstack/react-query';
import { api, ApiException } from '@/core/api';
import { useSession } from '@/core/session';
import { orderKeys, type Order } from '@/features/orders/api';
import { shopFetch, type ShopOrderInput, type ShopOrderResult } from './api';
import type { CartLine } from './cart';

export interface SubmitOutcome {
  done: { line: CartLine; result: ShopOrderResult }[];
  failed: { line: CartLine; error: string }[];
  /** Tarmoq uzilgani uchun yuborilmay qolganlar. */
  skipped: CartLine[];
}

/**
 * Savatni yuborish: har qator — alohida, mavjud `ShopOrderInput` (`POST /api/public/shop/order`),
 * KETMA-KET (server bir vaqtda ko'p ariza olmasin, natija tartibi aniq bo'lsin).
 * Server bitta qatorni rad etsa (4xx) — qolganlari davom etadi; tarmoq uzilsa — to'xtaydi,
 * qolganlari `skipped` bo'lib savatda qoladi. Hech narsa "yuborildi" deb soxta belgilanmaydi.
 */
export async function submitCart(
  lines: CartLine[],
  base: Omit<ShopOrderInput, 'productId' | 'qty'>,
  onProgress?: (doneCount: number) => void,
): Promise<SubmitOutcome> {
  const out: SubmitOutcome = { done: [], failed: [], skipped: [] };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    try {
      const result = await shopFetch<ShopOrderResult>('/order', { method: 'POST', body: { ...base, productId: line.productId, qty: line.qty } satisfies ShopOrderInput });
      out.done.push({ line, result });
      onProgress?.(out.done.length);
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
    refetchInterval: enabled ? 30_000 : false,
  });
  return { ...q, enabled };
}

/** Yo'ldagi / yuklanayotgan reys holatlari — faqat shularda jonli kuzatish bor. */
export const LIVE_STATUSES = ['ACCEPTED', 'LOADING', 'EN_ROUTE', 'ARRIVED', 'UNLOADING'];
