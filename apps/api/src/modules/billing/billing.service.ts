import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentMethod } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';

const D = Prisma.Decimal;

/** Faktura holati har doim summalardan kelib chiqadi (to'lov, yangi qator, yetkazish haqi — har qanday o'zgarishdan keyin). */
export function invoiceStatusFor(amount: Prisma.Decimal, paidAmount: Prisma.Decimal): 'OPEN' | 'PARTIALLY_PAID' | 'PAID' {
  return amount.gt(0) && paidAmount.gte(amount) ? 'PAID' : paidAmount.gt(0) ? 'PARTIALLY_PAID' : 'OPEN';
}

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
      const inv = await tx.invoice.update({ where: { id: invoice.id }, data: { amount: { increment: amount } } });
      // Summa o'sdi — "PAID" bo'lib qolgan faktura yana qarzdor bo'lishi mumkin
      await tx.invoice.update({ where: { id: inv.id }, data: { status: invoiceStatusFor(inv.amount, inv.paidAmount) } });
      return line;
    }).catch((e: unknown) => {
      // Parallel ikki chaqiruv (hodisa + reconcile): qator unique(deliveryId) — ikkinchisi mavjudini qaytaradi
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return this.prisma.invoiceLine.findUnique({ where: { deliveryId } });
      throw e;
    });
  }

  /**
   * order.delivered → yetkazish haqi qo'shiladi va faktura chiqariladi.
   *
   * Avval yarashtirish (reconcile): yakunlangan, lekin qatori yo'q reyslar qo'shiladi. `delivery.completed` va
   * `order.delivered` ikkalasi asinxron hodisa — tartibi kafolatlanmagan, listener xato bersa qayta urinish yo'q edi.
   * Shu sabab bir reysli buyurtmada faktura hali yaratilmay turib bu yerga kelinsa, yetkazish haqi abadiy qo'shilmay qolardi.
   */
  async issueForOrder(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { deliveries: { where: { status: 'COMPLETED', invoiceLine: null }, select: { id: true } } },
    });
    if (order.externalRef) return null;
    for (const d of order.deliveries ?? []) await this.addDeliveryLine(d.id);
    const invoice = await this.prisma.invoice.findUnique({ where: { orderId } });
    if (!invoice) return null; // birorta hisobga yoziladigan reys yo'q
    // Idempotent: order.delivered qayta kelsa (qayta urinish, poyga) yetkazish haqi ikkinchi marta qo'shilmaydi
    if (invoice.issuedAt) return invoice;
    const r = await this.prisma.invoice.updateMany({
      where: { id: invoice.id, issuedAt: null },
      data: { amount: { increment: order.deliveryFee }, issuedAt: new Date() },
    });
    const inv = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    if (r.count === 1) await this.prisma.invoice.update({ where: { id: inv.id }, data: { status: invoiceStatusFor(inv.amount, inv.paidAmount) } });
    return inv;
  }

  /**
   * Idempotent to'lov: externalId unique (tashqi tizim, masalan ERP, yoki kassadagi Idempotency-Key qayta yuborsa ham bir marta).
   * Qoldiqdan ortiq to'lov qabul qilinmaydi — "ikki marta bosish" yoki xato summa qarzni manfiyga tushirmasin.
   */
  async recordPayment(input: { invoiceId: string; method: PaymentMethod; amount: number; externalId?: string; byUserId?: string }) {
    if (input.externalId) {
      const exists = await this.prisma.payment.findUnique({ where: { externalId: input.externalId } });
      if (exists) return exists;
    }
    const amount = new D(input.amount).toDecimalPlaces(2);
    if (amount.lte(0)) throw new DomainError('VALIDATION', "To'lov summasi musbat bo'lsin");
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.invoice.findUniqueOrThrow({ where: { id: input.invoiceId }, select: { status: true, amount: true, paidAmount: true } });
      if (target.status === 'VOID') throw new DomainError('VALIDATION', "Faktura bekor qilingan — to'lov qabul qilinmaydi");
      const remaining = target.amount.minus(target.paidAmount);
      if (amount.gt(remaining)) {
        throw new DomainError('VALIDATION', `To'lov qoldiqdan (${remaining.toString()}) ko'p bo'lolmaydi`, { amount: amount.toNumber(), remaining: remaining.toNumber() });
      }
      const p = await tx.payment.create({ data: { invoiceId: input.invoiceId, method: input.method, amount, externalId: input.externalId, recordedByUserId: input.byUserId } });
      // Atomar: qoldiq tekshiruvi bilan yozuv orasida boshqa to'lov tushgan bo'lsa — ortiqcha o'tib ketmaydi
      const r = await tx.invoice.updateMany({ where: { id: input.invoiceId, paidAmount: { lte: target.amount.minus(amount) } }, data: { paidAmount: { increment: amount } } });
      if (r.count !== 1) throw new DomainError('VALIDATION', "To'lov qoldiqdan ko'p — faktura shu orada to'langan");
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
      await tx.invoice.update({ where: { id: inv.id }, data: { status: invoiceStatusFor(inv.amount, inv.paidAmount) } });
      return p;
    }).catch(async (e: unknown) => {
      // Bir xil externalId bilan parallel takror — birinchisi yozilgan, ikkinchisiga o'sha
      if (input.externalId && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const exists = await this.prisma.payment.findUnique({ where: { externalId: input.externalId } });
        if (exists) return exists;
      }
      throw e;
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

  /**
   * Kassa: naqd to'lov. ERP buyurtmasining schyoti ERP kassasida yopiladi (u paidAmount'ni o'zi yuboradi) —
   * bu yerda qabul qilinsa ERP keyingi sinxronda ustidan yozib, pul "yo'qolardi".
   * `idempotencyKey` (ilovadagi Idempotency-Key) → externalId: tarmoq uzilib qayta yuborilsa ikkinchi to'lov yozilmaydi.
   */
  async cashPayment(a: AuthContext, invoiceId: string, amount: number, idempotencyKey?: string) {
    const inv = await this.prisma.invoice.findFirst({ where: { id: invoiceId, order: { plantOrgId: a.orgId! } }, include: { order: { select: { externalRef: true } } } });
    if (!inv) throw DomainError.notFound('Faktura');
    if (inv.order.externalRef) throw new DomainError('VALIDATION', "Bu schyot ERP'da yuritiladi — to'lovni ERP kassasida qabul qiling");
    return this.recordPayment({ invoiceId, method: 'CASH', amount, byUserId: a.userId, externalId: idempotencyKey ? `cash:${a.orgId}:${idempotencyKey}` : undefined });
  }
}
