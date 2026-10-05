import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentMethod } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';

const D = Prisma.Decimal;

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  /** delivery.completed → InvoiceLine (faktura yo'q bo'lsa yaratiladi). acceptedM3 bo'lsa shu, aks holda loadedM3/plannedM3. */
  async addDeliveryLine(deliveryId: string) {
    const d = await this.prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId }, include: { order: { include: { items: true } }, invoiceLine: true } });
    if (d.invoiceLine) return d.invoiceLine;
    // ERP'dan kelgan buyurtma: schyot va summa ERP'niki (PUT /erp/invoices). Bu yerda qator qo'shilsa ERP summasi
    // ustiga reyslar yana qo'shilib, mijoz qarzi ikki barobar ko'rinardi (kredit limiti ham noto'g'ri "oshdi" derdi).
    if (d.order.externalRef) return null;
    const qty = d.acceptedM3 ?? d.loadedM3 ?? d.plannedM3;
    // Sodda: buyurtmada bitta marka bo'lsa uning narxi; ko'p bo'lsa o'rtacha vaznli
    const items = d.order.items;
    const totalVol = items.reduce((s, i) => s.plus(i.volumeM3), new D(0));
    if (totalVol.lte(0)) return null; // hajmsiz buyurtma — narxni aniqlab bo'lmaydi (0 ga bo'lish)
    // Narx 2 xonagacha yaxlitlanadi va summa SHU narxdan hisoblanadi: DB'da unitPrice Decimal(14,2) —
    // ilgari summa yaxlitlanmagan narxdan chiqib, qatorda "hajm × narx ≠ summa" bo'lardi
    const unitPrice = items.reduce((s, i) => s.plus(i.unitPriceSnapshot.mul(i.volumeM3)), new D(0)).div(totalVol).toDecimalPlaces(2);
    const amount = qty.mul(unitPrice).toDecimalPlaces(2);

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.upsert({
        where: { orderId: d.orderId },
        create: { orderId: d.orderId, clientOrgId: d.order.clientOrgId, amount: new D(0) },
        update: {},
      });
      const line = await tx.invoiceLine.create({
        data: { invoiceId: invoice.id, deliveryId, description: `Reys ${d.sequence}: ${items.map((i) => i.gradeSnapshot).join('/')}`, quantityM3: qty, unitPrice, amount },
      });
      await tx.invoice.update({ where: { id: invoice.id }, data: { amount: { increment: amount } } });
      return line;
    });
  }

  /** order.delivered → yetkazish haqi qo'shiladi va faktura chiqariladi. */
  async issueForOrder(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const invoice = await this.prisma.invoice.findUnique({ where: { orderId } });
    if (!invoice || order.externalRef) return null;
    // Idempotent: order.delivered qayta kelsa (qayta urinish, poyga) yetkazish haqi ikkinchi marta qo'shilmaydi
    if (invoice.issuedAt) return invoice;
    await this.prisma.invoice.updateMany({
      where: { id: invoice.id, issuedAt: null },
      data: { amount: { increment: order.deliveryFee }, issuedAt: new Date() },
    });
    return this.prisma.invoice.findUnique({ where: { id: invoice.id } });
  }

  /** Idempotent to'lov: externalId unique (tashqi tizim, masalan ERP, qayta yuborsa ham bir marta). */
  async recordPayment(input: { invoiceId: string; method: PaymentMethod; amount: number; externalId?: string; byUserId?: string }) {
    if (input.externalId) {
      const exists = await this.prisma.payment.findUnique({ where: { externalId: input.externalId } });
      if (exists) return exists;
    }
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.invoice.findUniqueOrThrow({ where: { id: input.invoiceId }, select: { status: true } });
      if (target.status === 'VOID') throw new DomainError('VALIDATION', 'Faktura bekor qilingan — to\'lov qabul qilinmaydi');
      const p = await tx.payment.create({ data: { invoiceId: input.invoiceId, method: input.method, amount: new D(input.amount), externalId: input.externalId, recordedByUserId: input.byUserId } });
      const inv = await tx.invoice.update({ where: { id: input.invoiceId }, data: { paidAmount: { increment: p.amount } } });
      const status = inv.paidAmount.gte(inv.amount) ? 'PAID' : inv.paidAmount.gt(0) ? 'PARTIALLY_PAID' : 'OPEN';
      await tx.invoice.update({ where: { id: inv.id }, data: { status } });
      return p;
    });
  }

  /** Tadbirkor (PLANT): mijozlar bo'yicha qarz. Quruvchi/Tadbirkor (CONTRACTOR): o'z qarzi. */
  async summary(a: AuthContext) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: a.orgId! } });
    const where: Prisma.InvoiceWhereInput = org.type === 'PLANT' ? { order: { plantOrgId: a.orgId! } } : { clientOrgId: a.orgId! };
    const invoices = await this.prisma.invoice.findMany({
      where: { ...where, status: { in: ['OPEN', 'PARTIALLY_PAID', 'PAID'] } },
      include: { client: { select: { id: true, name: true } }, order: { select: { number: true } }, payments: { orderBy: { paidAt: 'desc' }, take: 3 } },
      orderBy: { createdAt: 'desc' },
    });
    const byClient = new Map<string, { clientId: string; name: string; debt: Prisma.Decimal; invoices: number }>();
    let totalDebt = new D(0);
    for (const inv of invoices) {
      const debt = inv.amount.minus(inv.paidAmount);
      totalDebt = totalDebt.plus(debt);
      const c = byClient.get(inv.clientOrgId) ?? { clientId: inv.clientOrgId, name: inv.client.name, debt: new D(0), invoices: 0 };
      c.debt = c.debt.plus(debt); c.invoices += 1;
      byClient.set(inv.clientOrgId, c);
    }
    return { totalDebt, clients: [...byClient.values()].sort((x, y) => y.debt.comparedTo(x.debt)), invoices: invoices.slice(0, 50) };
  }

  async cashPayment(a: AuthContext, invoiceId: string, amount: number) {
    const inv = await this.prisma.invoice.findFirst({ where: { id: invoiceId, order: { plantOrgId: a.orgId! } } });
    if (!inv) throw DomainError.notFound('Faktura');
    return this.recordPayment({ invoiceId, method: 'CASH', amount, byUserId: a.userId });
  }
}
