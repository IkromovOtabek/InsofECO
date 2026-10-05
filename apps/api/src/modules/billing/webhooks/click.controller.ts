import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { Public } from '../../../common/auth/decorators';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { BillingService } from '../billing.service';
import { invoiceDue, invoicePayable, paymentsTestMode, safeEqual } from './payment-security';

const D = Prisma.Decimal;

/** Click SHOP API xato kodlari */
const E = {
  SIGN: -1,
  WRONG_AMOUNT: -2,
  ACTION: -3,
  ALREADY_PAID: -4,
  INVOICE_NOT_FOUND: -5,
  TX_NOT_FOUND: -6,
  BAD_REQUEST: -8,
  CANCELLED: -9,
} as const;

/**
 * Click SHOP API: action=0 (Prepare), action=1 (Complete).
 * sign_string = md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + [merchant_prepare_id +] amount + action + sign_time)
 * merchant_trans_id — Invoice.id. Summa SO'MDA (masalan "150000.00") — faktura qolgan qarziga teng bo'lishi shart.
 * Imzo har doim tekshiriladi; CLICK_SECRET_KEY yo'q bo'lsa rad (faqat PAYMENTS_TEST_MODE=true bundan mustasno).
 * Complete idempotent: shu click_trans_id bilan takror kelsa — o'sha javob, to'lov ikkinchi marta yozilmaydi.
 */
@Controller({ path: 'billing/payments/click', version: '1' })
export class ClickWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(@Body() b: Record<string, string>) {
    const action = Number(b.action);
    if (!this.signed(b, action)) return { error: E.SIGN, error_note: 'SIGN CHECK FAILED' };
    const echo = { click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id };
    if (!b.click_trans_id) return { ...echo, error: E.BAD_REQUEST, error_note: 'Error in request from click' };

    const invoice = await this.prisma.invoice.findUnique({ where: { id: b.merchant_trans_id ?? '' } });
    if (!invoice) return { ...echo, error: E.INVOICE_NOT_FOUND, error_note: 'Faktura topilmadi' };
    const externalId = `click:${b.click_trans_id}`;

    if (action === 0) {
      const bad = this.check(invoice, b.amount);
      if (bad) return { ...echo, ...bad };
      return { ...echo, merchant_prepare_id: invoice.id, error: 0, error_note: 'Success' };
    }

    if (action === 1) {
      if (b.merchant_prepare_id !== invoice.id) return { ...echo, error: E.TX_NOT_FOUND, error_note: 'Transaction does not exist' };
      const success = { ...echo, merchant_confirm_id: invoice.id, error: 0, error_note: 'Success' };
      // Idempotent: shu tranzaksiya allaqachon yozilgan bo'lsa — o'sha natija
      const existing = await this.prisma.payment.findUnique({ where: { externalId } });
      if (existing) return existing.invoiceId === invoice.id ? success : { ...echo, error: E.TX_NOT_FOUND, error_note: 'Transaction does not exist' };
      if (Number(b.error) < 0) return { ...echo, error: E.CANCELLED, error_note: 'Cancelled' };
      const bad = this.check(invoice, b.amount);
      if (bad) return { ...echo, ...bad };

      try {
        const applied = await this.prisma.$transaction(async (tx) => {
          // Optimistik qulf: tekshiruvdan keyin faktura o'zgargan bo'lsa (parallel to'lov) — yozilmaydi
          const r = await tx.invoice.updateMany({
            where: { id: invoice.id, status: { in: ['OPEN', 'PARTIALLY_PAID'] }, paidAmount: invoice.paidAmount },
            data: { paidAmount: { increment: new D(b.amount) } },
          });
          if (r.count !== 1) return false;
          await tx.payment.create({ data: { invoiceId: invoice.id, method: 'CLICK', amount: new D(b.amount), externalId, status: 'CONFIRMED' } });
          const upd = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
          await tx.invoice.update({ where: { id: upd.id }, data: { status: upd.paidAmount.gte(upd.amount) ? 'PAID' : 'PARTIALLY_PAID' } });
          return true;
        });
        if (!applied) return { ...echo, error: E.ALREADY_PAID, error_note: 'Already paid' };
      } catch (e) {
        // Bir vaqtda kelgan ikki Complete — externalId unique; ikkinchisi birinchisining natijasini oladi
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return success;
        throw e;
      }
      return success;
    }
    return { ...echo, error: E.ACTION, error_note: 'Action not found' };
  }

  private signed(b: Record<string, string>, action: number): boolean {
    const secret = process.env.CLICK_SECRET_KEY;
    if (!secret) return paymentsTestMode();
    const base = `${b.click_trans_id}${b.service_id}${secret}${b.merchant_trans_id}${action === 1 ? b.merchant_prepare_id : ''}${b.amount}${b.action}${b.sign_time}`;
    const sign = createHash('md5').update(base).digest('hex');
    return safeEqual(String(b.sign_string ?? '').toLowerCase(), sign);
  }

  /** Faktura holati va summa (so'm) tekshiruvi. null — hammasi joyida. */
  private check(inv: { status: string; amount: Prisma.Decimal; paidAmount: Prisma.Decimal }, amount: string | undefined) {
    if (inv.status === 'PAID') return { error: E.ALREADY_PAID, error_note: 'Already paid' };
    if (!invoicePayable(inv)) return { error: E.CANCELLED, error_note: 'Faktura bekor qilingan' };
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0 || !new D(amount).equals(invoiceDue(inv))) return { error: E.WRONG_AMOUNT, error_note: 'Incorrect parameter amount' };
    return null;
  }
}
