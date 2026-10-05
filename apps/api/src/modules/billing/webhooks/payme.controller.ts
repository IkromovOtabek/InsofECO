import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Public } from '../../../common/auth/decorators';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { BillingService } from '../billing.service';
import { invoiceDue, invoicePayable, paymentsTestMode, safeEqual } from './payment-security';

const D = Prisma.Decimal;

/** Payme Merchant API xato kodlari */
const E = {
  AUTH: -32504,
  METHOD: -32601,
  WRONG_AMOUNT: -31001,
  TX_NOT_FOUND: -31003,
  CANNOT_CANCEL: -31007,
  CANNOT_PERFORM: -31008,
  INVOICE_NOT_FOUND: -31050,
  /** Faktura to'lanib bo'lgan yoki bekor qilingan (account xatolari oralig'i -31050..-31099) */
  INVOICE_NOT_PAYABLE: -31051,
  /** Shu faktura bo'yicha boshqa Payme tranzaksiyasi kutilmoqda */
  INVOICE_BUSY: -31099,
} as const;

/** Tranzaksiya ichidan protokol xatosini qaytarish uchun */
class PaymeError extends Error {
  constructor(readonly code: number, message: string) { super(message); }
}

/**
 * Payme Merchant API (JSON-RPC): CheckPerformTransaction, CreateTransaction, PerformTransaction, CheckTransaction, CancelTransaction.
 * account.invoice_id — bizning Invoice.id. Summalar TIYINDA (so'm × 100) — faktura qolgan qarzi × 100 ga teng bo'lishi shart.
 * Basic auth (Paycom:<PAYME_KEY>) har doim tekshiriladi; kalit yo'q bo'lsa rad (faqat PAYMENTS_TEST_MODE=true bundan mustasno).
 * Perform/Cancel idempotent: takroriy chaqiruv bir xil javob qaytaradi, paidAmount ikki marta oshmaydi.
 */
@Controller({ path: 'billing/payments/payme', version: '1' })
export class PaymeWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(@Body() rpc: { id: number; method: string; params: Record<string, unknown> }, @Headers('authorization') auth?: string) {
    if (!this.authorized(auth)) return this.err(rpc?.id, E.AUTH, "Ruxsat yo'q");
    try {
      return await this.dispatch(rpc.id, rpc.method, rpc.params ?? {});
    } catch (e) {
      if (e instanceof PaymeError) return this.err(rpc.id, e.code, e.message);
      throw e;
    }
  }

  private authorized(auth?: string): boolean {
    const key = process.env.PAYME_KEY;
    if (!key) return paymentsTestMode();
    const expected = 'Basic ' + Buffer.from(`Paycom:${key}`).toString('base64');
    return safeEqual(auth, expected);
  }

  private async dispatch(id: number, method: string, params: Record<string, unknown>) {
    const account = params.account as { invoice_id?: string } | undefined;
    const txId = String(params.id ?? '');
    const externalId = `payme:${txId}`;

    switch (method) {
      case 'CheckPerformTransaction': {
        await this.payableInvoice(account?.invoice_id, params.amount);
        return this.ok(id, { allow: true });
      }
      case 'CreateTransaction': {
        if (!txId) throw new PaymeError(E.TX_NOT_FOUND, "Tranzaksiya id yo'q");
        const existing = await this.prisma.payment.findUnique({ where: { externalId } });
        if (existing) {
          if (existing.status !== 'PENDING') throw new PaymeError(E.CANNOT_PERFORM, 'Tranzaksiya yakunlangan yoki bekor qilingan');
          return this.ok(id, { create_time: existing.createdAt.getTime(), transaction: existing.id, state: 1 });
        }
        const p = await this.prisma.$transaction(async (tx) => {
          // Faktura qatorini qulflaymiz: bir vaqtda kelgan ikki CreateTransaction ikkalasi ham "band emas" deb o'tmasin
          await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${account?.invoice_id ?? ''} FOR UPDATE`;
          const inv = await this.payableInvoice(account?.invoice_id, params.amount, tx);
          const pending = await tx.payment.findFirst({ where: { invoiceId: inv.id, method: 'PAYME', status: 'PENDING', externalId: { not: externalId } } });
          if (pending) throw new PaymeError(E.INVOICE_BUSY, "Bu faktura bo'yicha boshqa tranzaksiya kutilmoqda");
          return tx.payment.create({ data: { invoiceId: inv.id, method: 'PAYME', amount: new D(Number(params.amount)).div(100), externalId, status: 'PENDING' } });
        });
        return this.ok(id, { create_time: p.createdAt.getTime(), transaction: p.id, state: 1 });
      }
      case 'PerformTransaction': {
        const p = await this.prisma.payment.findUnique({ where: { externalId } });
        if (!p) throw new PaymeError(E.TX_NOT_FOUND, 'Tranzaksiya topilmadi');
        // Bekor qilingan tranzaksiyani o'tkazib bo'lmaydi — fakturaga pul yozilmaydi
        if (p.status === 'CANCELLED') throw new PaymeError(E.CANNOT_PERFORM, 'Tranzaksiya bekor qilingan');
        if (p.status === 'PENDING') {
          await this.prisma.$transaction(async (tx) => {
            const inv = await tx.invoice.findUnique({ where: { id: p.invoiceId }, select: { status: true } });
            if (!inv || inv.status === 'VOID') throw new PaymeError(E.CANNOT_PERFORM, 'Faktura bekor qilingan');
            // Atomar: Payme PerformTransaction'ni qayta yuborsa (timeout) — paidAmount ikki marta oshmasin
            const r = await tx.payment.updateMany({ where: { id: p.id, status: 'PENDING' }, data: { status: 'CONFIRMED', paidAt: new Date() } });
            if (r.count !== 1) return;
            const upd = await tx.invoice.update({ where: { id: p.invoiceId }, data: { paidAmount: { increment: p.amount } } });
            await tx.invoice.update({ where: { id: upd.id }, data: { status: upd.paidAmount.gte(upd.amount) ? 'PAID' : 'PARTIALLY_PAID' } });
          });
        }
        // Takroriy chaqiruv — saqlangan perform_time qaytariladi (Date.now() emas)
        const done = await this.prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
        if (done.status !== 'CONFIRMED') throw new PaymeError(E.CANNOT_PERFORM, 'Tranzaksiya bekor qilingan');
        return this.ok(id, { transaction: done.id, perform_time: done.paidAt.getTime(), state: 2 });
      }
      case 'CheckTransaction': {
        const p = await this.prisma.payment.findUnique({ where: { externalId } });
        if (!p) throw new PaymeError(E.TX_NOT_FOUND, 'Tranzaksiya topilmadi');
        const state = p.status === 'CONFIRMED' ? 2 : p.status === 'CANCELLED' ? -1 : 1;
        return this.ok(id, {
          create_time: p.createdAt.getTime(),
          perform_time: state === 2 ? p.paidAt.getTime() : 0,
          // Bekor qilinganda paidAt = bekor qilingan vaqt (alohida ustun yo'q)
          cancel_time: state === -1 ? p.paidAt.getTime() : 0,
          transaction: p.id, state, reason: null,
        });
      }
      case 'CancelTransaction': {
        const p = await this.prisma.payment.findUnique({ where: { externalId } });
        if (!p) throw new PaymeError(E.TX_NOT_FOUND, 'Tranzaksiya topilmadi');
        // O'tkazilgan to'lovni bekor qilish (refund) — biznes qarori; hozircha rad
        if (p.status === 'CONFIRMED') throw new PaymeError(E.CANNOT_CANCEL, "O'tkazilgan to'lovni bekor qilib bo'lmaydi");
        if (p.status === 'PENDING') await this.prisma.payment.updateMany({ where: { id: p.id, status: 'PENDING' }, data: { status: 'CANCELLED', paidAt: new Date() } });
        // Takroriy chaqiruv — birinchi bekor qilish vaqti qaytariladi
        const c = await this.prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
        if (c.status === 'CONFIRMED') throw new PaymeError(E.CANNOT_CANCEL, "O'tkazilgan to'lovni bekor qilib bo'lmaydi");
        return this.ok(id, { transaction: c.id, cancel_time: c.paidAt.getTime(), state: -1 });
      }
      default:
        throw new PaymeError(E.METHOD, 'Metod topilmadi');
    }
  }

  /** Faktura bor, to'lanadigan holatda (OPEN/PARTIALLY_PAID) va summa (tiyin) = qolgan qarz (so'm) × 100. */
  private async payableInvoice(invoiceId: string | undefined, amount: unknown, tx: Prisma.TransactionClient = this.prisma) {
    const inv = invoiceId ? await tx.invoice.findUnique({ where: { id: invoiceId } }) : null;
    if (!inv) throw new PaymeError(E.INVOICE_NOT_FOUND, 'Faktura topilmadi');
    if (!invoicePayable(inv)) throw new PaymeError(E.INVOICE_NOT_PAYABLE, "Faktura to'langan yoki bekor qilingan");
    const tiyin = Number(amount);
    if (!Number.isInteger(tiyin) || tiyin <= 0 || !new D(tiyin).equals(invoiceDue(inv).mul(100))) {
      throw new PaymeError(E.WRONG_AMOUNT, "Noto'g'ri summa");
    }
    return inv;
  }

  private ok(id: number, result: unknown) { return { jsonrpc: '2.0', id, result }; }
  private err(id: number, code: number, message: string) { return { jsonrpc: '2.0', id, error: { code, message } }; }
}
