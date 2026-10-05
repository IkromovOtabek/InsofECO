import { createHash, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';

/**
 * To'lov shlyuzlari (Payme/Click) uchun umumiy xavfsizlik yordamchilari.
 *
 * Maxfiy kalit (PAYME_KEY / CLICK_SECRET_KEY) bo'lmasa so'rov HAR QANDAY muhitda rad etiladi (fail closed).
 * Yagona istisno — aniq `PAYMENTS_TEST_MODE=true` (lokal/sandbox sinov). NODE_ENV'ga bog'liq emas:
 * staging yoki NODE_ENV yozilmagan prod ham himoyalangan.
 */
export function paymentsTestMode(): boolean {
  return process.env.PAYMENTS_TEST_MODE === 'true';
}

/** Vaqtga bog'liq bo'lmagan taqqoslash: ikkala satrning sha256 xeshi solishtiriladi (uzunlik farqi ham sizmaydi). */
export function safeEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

/**
 * Shlyuz orqali to'lanadigan summa = fakturaning QOLGAN qarzi (amount − paidAmount), so'mda.
 * Faktura qisman naqd to'langan bo'lishi mumkin — shlyuz qolgan qismini to'liq yopadi.
 */
export function invoiceDue(inv: { amount: Prisma.Decimal; paidAmount: Prisma.Decimal }): Prisma.Decimal {
  return inv.amount.minus(inv.paidAmount);
}

/** Faktura to'lov qabul qila oladimi (VOID — bekor, PAID — allaqachon yopilgan). */
export function invoicePayable(inv: { status: string }): boolean {
  return inv.status === 'OPEN' || inv.status === 'PARTIALLY_PAID';
}
