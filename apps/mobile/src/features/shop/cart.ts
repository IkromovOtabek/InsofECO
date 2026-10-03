import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { kv } from '@/core/storage';
import type { ShopItem, ShopOrderResult } from './api';

/**
 * Do'kon savati — faqat telefonda (MMKV). ERP'da savat API'si yo'q: "Buyurtmani tasdiqlash"
 * har bir qatorni alohida, mavjud `ShopOrderInput` (`POST /order`) orqali yuboradi.
 * Muvaffaqiyatli yuborilganlar `sent` ro'yxatiga tushadi — "Buyurtma" tabi shuni ko'rsatadi.
 * Saralanganlar (yulduzcha) ham shu yerda — faqat shu telefonda.
 */
export interface CartLine {
  productId: string;
  name: string;
  code: string;
  group: string | null;
  unit: string;
  unitLabel: string;
  price: number;
  photo: string | null;
  minQty: number | null;
  qty: number;
}

/** Serverga yuborilgan (qabul qilingan) ariza — server javobidagi raqam bo'lsa u ham. */
export interface SentOrder {
  key: string;
  at: string;
  line: CartLine;
  total: number;
  address?: string;
  when?: string;
  pay?: string;
  number?: string;
  message?: string;
}

export interface Contact { name: string; phone: string; address: string }

interface CartState {
  lines: CartLine[];
  sent: SentOrder[];
  favs: string[];
  contact: Contact;
  add: (item: ShopItem, qty: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  /** Yuborilganlarni savatdan olib, tarixga yozadi. */
  markSent: (done: { line: CartLine; result: ShopOrderResult }[], meta: { address?: string; when?: string; pay?: string }) => SentOrder[];
  toggleFav: (productId: string) => void;
  setContact: (c: Partial<Contact>) => void;
}

const mmkv: StateStorage = {
  getItem: (k) => kv.getString(k) ?? null,
  setItem: (k, v) => kv.set(k, v),
  removeItem: (k) => kv.delete(k),
};

export const lineOf = (item: ShopItem, qty: number): CartLine => ({
  productId: item.id, name: item.name, code: item.code, group: item.group, unit: item.unit, unitLabel: item.unitLabel,
  price: item.price, photo: item.photo, minQty: item.minQty, qty,
});

const round1 = (n: number) => Math.round(n * 10) / 10;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      sent: [],
      favs: [],
      contact: { name: '', phone: '', address: '' },
      add: (item, qty) => set((s) => {
        const q = round1(Math.max(qty, item.minQty ?? 0));
        const has = s.lines.find((l) => l.productId === item.id);
        // Narx/nom yangilangan bo'lsa ham savatda eng so'nggisi turadi
        return { lines: has ? s.lines.map((l) => (l.productId === item.id ? { ...lineOf(item, round1(l.qty + q)) } : l)) : [...s.lines, lineOf(item, q)] };
      }),
      setQty: (id, qty) => set((s) => ({ lines: s.lines.map((l) => (l.productId === id ? { ...l, qty: round1(Math.max(qty, l.minQty ?? 0.5)) } : l)) })),
      remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.productId !== id) })),
      clear: () => set({ lines: [] }),
      markSent: (done, meta) => {
        const at = new Date().toISOString();
        const rows: SentOrder[] = done.map(({ line, result }, i) => ({
          key: `${Date.now()}-${i}-${line.productId}`, at, line, total: line.qty * line.price, ...meta,
          number: result.number != null ? String(result.number) : result.id != null ? String(result.id) : undefined,
          message: result.message,
        }));
        const ids = new Set(done.map((d) => d.line.productId));
        set((s) => ({ lines: s.lines.filter((l) => !ids.has(l.productId)), sent: [...rows, ...s.sent].slice(0, 100) }));
        return rows;
      },
      toggleFav: (id) => set((s) => ({ favs: s.favs.includes(id) ? s.favs.filter((f) => f !== id) : [...s.favs, id] })),
      setContact: (c) => set((s) => ({ contact: { ...s.contact, ...c } })),
    }),
    {
      name: 'shop.cart',
      storage: createJSONStorage(() => mmkv),
      partialize: (s) => ({ lines: s.lines, sent: s.sent, favs: s.favs, contact: s.contact }),
      version: 1,
    },
  ),
);

/** Savatdagi qatorlar soni (tab nishoni). */
export const useCartCount = () => useCart((s) => s.lines.length);
export const cartTotal = (lines: CartLine[]) => lines.reduce((a, l) => a + l.qty * l.price, 0);
