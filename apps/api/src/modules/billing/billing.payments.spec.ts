import { Prisma } from '@prisma/client';
import { BillingService, invoiceStatusFor } from './billing.service';

const D = Prisma.Decimal;

function setup(inv: { amount: number; paidAmount: number; status?: string }) {
  const state = { amount: new D(inv.amount), paidAmount: new D(inv.paidAmount), status: inv.status ?? 'OPEN' };
  const tx = {
    invoice: {
      findUniqueOrThrow: jest.fn(async () => ({ id: 'i1', ...state })),
      updateMany: jest.fn(async ({ where, data }: { where: { paidAmount: { lte: Prisma.Decimal } }; data: { paidAmount: { increment: Prisma.Decimal } } }) => {
        if (state.paidAmount.gt(where.paidAmount.lte)) return { count: 0 };
        state.paidAmount = state.paidAmount.plus(data.paidAmount.increment);
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }: { data: { status: string } }) => { state.status = data.status; return { id: 'i1', ...state }; }),
    },
    payment: { create: jest.fn(async ({ data }: { data: unknown }) => ({ id: 'p1', ...(data as object) })) },
  };
  const prisma = {
    payment: { findUnique: jest.fn().mockResolvedValue(null) },
    invoice: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { svc: new BillingService(prisma as never), prisma, tx, state };
}

describe('BillingService.recordPayment', () => {
  it("qoldiqdan ortiq to'lov rad etiladi", async () => {
    const { svc, tx } = setup({ amount: 100_000, paidAmount: 70_000 });
    await expect(svc.recordPayment({ invoiceId: 'i1', method: 'CASH', amount: 50_000 })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it("to'liq to'lansa PAID, qisman — PARTIALLY_PAID", async () => {
    const a = setup({ amount: 100_000, paidAmount: 0 });
    await a.svc.recordPayment({ invoiceId: 'i1', method: 'CASH', amount: 40_000 });
    expect(a.state.status).toBe('PARTIALLY_PAID');
    await a.svc.recordPayment({ invoiceId: 'i1', method: 'CASH', amount: 60_000 });
    expect(a.state.status).toBe('PAID');
    expect(a.state.paidAmount.toString()).toBe('100000');
  });

  it("manfiy/nol summa va VOID faktura — rad", async () => {
    const { svc } = setup({ amount: 100_000, paidAmount: 0, status: 'VOID' });
    await expect(svc.recordPayment({ invoiceId: 'i1', method: 'CASH', amount: 0 })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(svc.recordPayment({ invoiceId: 'i1', method: 'CASH', amount: 10 })).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('externalId takror — ikkinchi marta yozilmaydi', async () => {
    const { svc, prisma, tx } = setup({ amount: 100_000, paidAmount: 0 });
    prisma.payment.findUnique.mockResolvedValue({ id: 'p0' });
    await expect(svc.recordPayment({ invoiceId: 'i1', method: 'CASH', amount: 10, externalId: 'cash:org:k1' })).resolves.toEqual({ id: 'p0' });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});

describe('BillingService.cashPayment', () => {
  it("ERP buyurtmasining schyotiga naqd to'lov ECO'da qabul qilinmaydi", async () => {
    const { svc, prisma } = setup({ amount: 1, paidAmount: 0 });
    prisma.invoice.findFirst.mockResolvedValue({ id: 'i1', order: { externalRef: 'Z-1' } });
    await expect(svc.cashPayment({ userId: 'u', orgId: 'org', role: 'TADBIRKOR', sessionId: 's' }, 'i1', 10)).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('Idempotency-Key → externalId (tashkilotga bog\'langan)', async () => {
    const { svc, prisma, tx } = setup({ amount: 100, paidAmount: 0 });
    prisma.invoice.findFirst.mockResolvedValue({ id: 'i1', order: { externalRef: null } });
    await svc.cashPayment({ userId: 'u', orgId: 'org', role: 'TADBIRKOR', sessionId: 's' }, 'i1', 10, 'abc');
    expect(tx.payment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ externalId: 'cash:org:abc' }) });
  });
});

describe('BillingService.issueForOrder — yarashtirish', () => {
  it("qatori yo'q yakunlangan reyslar avval qo'shiladi, keyin yetkazish haqi bir marta", async () => {
    const prisma = {
      order: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'o1', externalRef: null, deliveryFee: new D(50_000), deliveries: [{ id: 'd1' }, { id: 'd2' }] }) },
      invoice: {
        findUnique: jest.fn().mockResolvedValue({ id: 'i1', issuedAt: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'i1', amount: new D(250_000), paidAmount: new D(0) }),
        update: jest.fn(),
      },
    };
    const svc = new BillingService(prisma as never);
    const addLine = jest.spyOn(svc, 'addDeliveryLine').mockResolvedValue(null);
    await svc.issueForOrder('o1');
    expect(addLine).toHaveBeenCalledTimes(2);
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'i1', issuedAt: null } }));
    expect(prisma.invoice.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { status: 'OPEN' } });
  });
});

describe('invoiceStatusFor', () => {
  it.each([
    [100, 0, 'OPEN'], [100, 30, 'PARTIALLY_PAID'], [100, 100, 'PAID'], [100, 120, 'PAID'], [0, 0, 'OPEN'],
  ])('%s / %s → %s', (amount, paid, status) => expect(invoiceStatusFor(new D(amount), new D(paid))).toBe(status));
});
