/**
 * E-commerce (do'kon) — Insof ERP'ning OMMAVIY endpointlari. Login talab qilmaydi:
 * ilova ochilganda mehmon shu vitrinani ko'radi va buyurtma qoldiradi.
 * `erpApi` ishlatilmaydi: u `/api/mobile` va Bearer tokenga bog'langan.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { config } from '@/core/config';
import { ApiException, fetchWithTimeout, parseJsonSafe } from '@/core/api';
import { appHeaders, checkUpdateRequired } from '@/core/app-update';
import type { ApiError } from '@insof/shared';

export interface ShopItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  unitLabel: string;
  strengthClass: string | null;
  price: number;
  description: string | null;
  /** Nisbiy yo'l (`/api/public/shop/photo/...`) — `photoUrl()` bilan to'liq manzil. */
  photo: string | null;
  badge: string | null;
  minQty: number | null;
  group: string | null;
  /** Mahsulot egasi (zavod) — kartada ko'rinadi, bosilsa `/(shop)/zavod` profili ochiladi. */
  sellerId?: string;
}
export interface ShopSeller {
  id: string; name: string; legalName: string | null; about: string | null; address: string | null;
  phone: string | null; phone2: string | null; email: string | null; workingHours: string | null;
  foundedYear: number | null; location: { lat: number; lng: number } | null;
  /** Qabul soatlari (Toshkent vaqti) va bugun yetkazish chegarasi — ERP Sozlamalar. Eski ERP'da yo'q. */
  hours?: { open: number; close: number; sunday: boolean; sameDayCutoff: number };
  /** `https://t.me/...` — bo'lmasa tugma ko'rinmaydi */
  telegram?: string | null;
}
/** Bosh sahifa swiper'idagi reklama (ERP → E-commerce → Reklama). */
export interface ShopBanner { id: string; title: string; subtitle: string | null; image: string | null; productId: string | null; buttonText: string | null }
export interface ShopCatalog {
  company: { name: string; phone: string | null; address: string | null };
  /** Eski ERP javobida bo'lmasligi mumkin — ilova baribir ishlasin */
  seller?: ShopSeller;
  banners?: ShopBanner[];
  items: ShopItem[];
}
export interface ShopCallbackInput { name: string; phone: string; message?: string }
export interface ShopOrderInput { productId: string; qty: number; name: string; phone: string; address?: string; note?: string }

export const photoUrl = (p: string | null) => (p ? `${config.erpUrl}${p}` : null);

/**
 * Do'kon so'rovi: 30 s vaqt chegarasi (`fetchWithTimeout` — yarim ochiq mobil aloqada abadiy osilmaydi),
 * versiya sarlavhalari va majburiy yangilanish (426) tekshiruvi. JSON bo'lmagan javob (proksi 502 HTML) — SyntaxError emas.
 *
 * `idempotencyKey` — bitta buyurtma urinishiga bitta kalit (har bosishga emas). Hozirgi ERP ommaviy
 * endpointi bu sarlavhani o'qimaydi (takrordan uni telefon bo'yicha 2 daqiqalik cheklov va ilovadagi
 * `inFlight` qulfi saqlaydi); server qo'llab-quvvatlay boshlasa — ilovani o'zgartirish shart emas.
 */
export async function shopFetch<T>(path: string, init?: { method?: 'POST'; body?: unknown; idempotencyKey?: string }): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json', ...appHeaders() };
  if (init?.idempotencyKey) headers['idempotency-key'] = init.idempotencyKey;
  const res = await fetchWithTimeout(`${config.erpUrl}/api/public/shop${path}`, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  }, 30_000);
  const json = parseJsonSafe(await res.text());
  if (!res.ok) {
    checkUpdateRequired(res.status, json);
    throw new ApiException(res.status, (json as ApiError | null) ?? ({ code: 'INTERNAL', message: 'Xato' } as ApiError));
  }
  return json as T;
}

/** Vitrina. Kesh 24 soat saqlanadi (PersistQueryClient) — internetsiz ham ro'yxat ochiladi. */
export const useShopCatalog = () =>
  useQuery({ queryKey: ['shop', 'catalog'], queryFn: () => shopFetch<ShopCatalog>(''), staleTime: 60_000 });

/**
 * Buyurtma javobi. Hozirgi ERP faqat `{ ok, message }` qaytaradi; raqam (`number`/`id`) keyinchalik
 * qo'shilsa muvaffaqiyat ekrani uni ko'rsatadi. Savat va to'lov API'si yo'q — savat telefonda
 * (`cart.ts`), tasdiqlanganda har qator alohida `POST /order` bo'lib ketadi (`orders.ts`).
 */
export interface ShopOrderResult { ok: true; message: string; id?: string | number; number?: string | number }

export const useShopOrder = () =>
  useMutation({ mutationFn: (body: ShopOrderInput) => shopFetch<ShopOrderResult>('/order', { method: 'POST', body }) });

/** "Menga qo'ng'iroq qiling" — mahsulotsiz so'rov (Aloqa bo'limi). */
export const useShopCallback = () =>
  useMutation({ mutationFn: (body: ShopCallbackInput) => shopFetch<{ ok: true; message: string }>('/callback', { method: 'POST', body }) });
