/**
 * E-commerce (do'kon) — Insof ERP'ning OMMAVIY endpointlari. Login talab qilmaydi:
 * ilova ochilganda mehmon shu vitrinani ko'radi va buyurtma qoldiradi.
 * `erpApi` ishlatilmaydi: u `/api/mobile` va Bearer tokenga bog'langan.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { config } from '@/core/config';
import { ApiException } from '@/core/api';
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

async function shopFetch<T>(path: string, init?: { method?: 'POST'; body?: unknown }): Promise<T> {
  const res = await fetch(`${config.erpUrl}/api/public/shop${path}`, {
    method: init?.method ?? 'GET',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) throw new ApiException(res.status, (json as ApiError | null) ?? ({ code: 'INTERNAL', message: 'Xato' } as ApiError));
  return json as T;
}

/** Vitrina. Kesh 24 soat saqlanadi (PersistQueryClient) — internetsiz ham ro'yxat ochiladi. */
export const useShopCatalog = () =>
  useQuery({ queryKey: ['shop', 'catalog'], queryFn: () => shopFetch<ShopCatalog>(''), staleTime: 60_000 });

export const useShopOrder = () =>
  useMutation({ mutationFn: (body: ShopOrderInput) => shopFetch<{ ok: true; message: string }>('/order', { method: 'POST', body }) });

/** "Menga qo'ng'iroq qiling" — mahsulotsiz so'rov (Aloqa bo'limi). */
export const useShopCallback = () =>
  useMutation({ mutationFn: (body: ShopCallbackInput) => shopFetch<{ ok: true; message: string }>('/callback', { method: 'POST', body }) });
