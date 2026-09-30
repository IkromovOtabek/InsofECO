/**
 * Kirishdan keyin qaytiladigan joy. Mehmon mahsulotda "Buyurtma berish" ni bossa login
 * ochiladi; kirib (yoki ro'yxatdan o'tib) bo'lgach Gate uni shu mahsulotga qaytaradi —
 * rol bo'limiga emas. Faqat xotirada: ilova qayta ochilsa unutiladi, bu to'g'ri.
 */
let pending: string | null = null;

export const afterLogin = {
  set: (path: string) => { pending = path; },
  /** Olingan joy o'chadi — bir marta ishlatiladi. */
  take: () => { const p = pending; pending = null; return p; },
  clear: () => { pending = null; },
  has: () => pending !== null,
};
