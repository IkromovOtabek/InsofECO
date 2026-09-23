import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Public } from '../../../common/auth/decorators';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { BillingService } from '../billing.service';

/**
 * Payme Merchant API (JSON-RPC). Minimal: CheckPerformTransaction, CreateTransaction, PerformTransaction, CheckTransaction, CancelTransaction.
 * account.invoice_id — bizning Invoice.id. Summalar tiyinda (so'm * 100).
 * Prod: Basic auth (Paycom:<KEY>) tekshiruvi majburiy.
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
    const expected = 'Basic ' + Buffer.from(`Paycom:${process.env.PAYME_KEY ?? ''}`).toString('base64');
    if (process.env.NODE_ENV === 'production' && auth !== expected) return this.err(rpc.id, -32504, 'Ruxsat yo\'q');

    const account = rpc.params.account as { invoice_id?: string } | undefined;
    const amountTiyin = Number(rpc.params.amount ?? 0);
    const txId = String(rpc.params.id ?? '');

    switch (rpc.method) {
      case 'CheckPerformTransaction': {
        const inv = await this.prisma.invoice.findUnique({ where: { id: account?.invoice_id ?? '' } });
        if (!inv || inv.status === 'PAID' || inv.status === 'VOID') return this.err(rpc.id, -31050, 'Faktura topilmadi');
        return this.ok(rpc.id, { allow: true });
      }
      case 'CreateTransaction': {
        const inv = await this.prisma.invoice.findUnique({ where: { id: account?.invoice_id ?? '' } });
        if (!inv) return this.err(rpc.id, -31050, 'Faktura topilmadi');
        const existing = await this.prisma.payment.findUnique({ where: { externalId: `payme:${txId}` } });
        if (existing) return this.ok(rpc.id, { create_time: existing.createdAt.getTime(), transaction: existing.id, state: existing.status === 'CONFIRMED' ? 2 : 1 });
        const p = await this.prisma.payment.create({ data: { invoiceId: inv.id, method: 'PAYME', amount: amountTiyin / 100, externalId: `payme:${txId}`, status: 'PENDING' } });
        return this.ok(rpc.id, { create_time: p.createdAt.getTime(), transaction: p.id, state: 1 });
      }
      case 'PerformTransaction': {
        const p = await this.prisma.payment.findUnique({ where: { externalId: `payme:${txId}` } });
        if (!p) return this.err(rpc.id, -31003, 'Tranzaksiya topilmadi');
        if (p.status !== 'CONFIRMED') {
          await this.prisma.$transaction(async (tx) => {
            await tx.payment.update({ where: { id: p.id }, data: { status: 'CONFIRMED', paidAt: new Date() } });
            const inv = await tx.invoice.update({ where: { id: p.invoiceId }, data: { paidAmount: { increment: p.amount } } });
            await tx.invoice.update({ where: { id: inv.id }, data: { status: inv.paidAmount.gte(inv.amount) ? 'PAID' : 'PARTIALLY_PAID' } });
          });
        }
        return this.ok(rpc.id, { transaction: p.id, perform_time: Date.now(), state: 2 });
      }
      case 'CheckTransaction': {
        const p = await this.prisma.payment.findUnique({ where: { externalId: `payme:${txId}` } });
        if (!p) return this.err(rpc.id, -31003, 'Tranzaksiya topilmadi');
        return this.ok(rpc.id, { create_time: p.createdAt.getTime(), perform_time: p.status === 'CONFIRMED' ? p.paidAt.getTime() : 0, cancel_time: 0, transaction: p.id, state: p.status === 'CONFIRMED' ? 2 : p.status === 'CANCELLED' ? -1 : 1, reason: null });
      }
      case 'CancelTransaction': {
        const p = await this.prisma.payment.findUnique({ where: { externalId: `payme:${txId}` } });
        if (!p) return this.err(rpc.id, -31003, 'Tranzaksiya topilmadi');
        if (p.status === 'PENDING') await this.prisma.payment.update({ where: { id: p.id }, data: { status: 'CANCELLED' } });
        // CONFIRMED bo'lgan to'lovni bekor qilish — biznes qarori (refund); hozircha rad
        return this.ok(rpc.id, { transaction: p.id, cancel_time: Date.now(), state: p.status === 'CONFIRMED' ? 2 : -1 });
      }
      default:
        return this.err(rpc.id, -32601, 'Metod topilmadi');
    }
  }

  private ok(id: number, result: unknown) { return { jsonrpc: '2.0', id, result }; }
  private err(id: number, code: number, message: string) { return { jsonrpc: '2.0', id, error: { code, message } }; }
}
