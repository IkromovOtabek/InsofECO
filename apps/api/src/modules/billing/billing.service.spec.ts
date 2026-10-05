import { Prisma } from '@prisma/client';
import { BillingService } from './billing.service';

const D = Prisma.Decimal;

describe('BillingService', () => {
  it("ERP buyurtmasiga ECO o'zi faktura qatori qo'shmaydi (summa ERP'niki)", async () => {
    const prisma = {
      delivery: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'd1', orderId: 'o1', invoiceLine: null, acceptedM3: new D(8), order: { externalRef: 'Z-1', items: [{ volumeM3: new D(8), unitPriceSnapshot: new D(700_000) }] } }) },
      $transaction: jest.fn(),
    };
    await expect(new BillingService(prisma as never).addDeliveryLine('d1')).resolves.toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('qator summasi yaxlitlangan narxdan: hajm × narx = summa', async () => {
    const tx = {
      invoice: { upsert: jest.fn().mockResolvedValue({ id: 'i1' }), update: jest.fn() },
      invoiceLine: { create: jest.fn((a: { data: unknown }) => a.data) },
    };
    const prisma = {
      delivery: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'd1', orderId: 'o1', sequence: 1, invoiceLine: null, acceptedM3: new D(7.5), order: { externalRef: null, clientOrgId: 'c', items: [
        { volumeM3: new D(1), unitPriceSnapshot: new D(100_000), gradeSnapshot: 'M200' },
        { volumeM3: new D(2), unitPriceSnapshot: new D(100_001), gradeSnapshot: 'M300' },
      ] } }) },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const line = (await new BillingService(prisma as never).addDeliveryLine('d1')) as unknown as { unitPrice: Prisma.Decimal; amount: Prisma.Decimal; quantityM3: Prisma.Decimal };
    expect(line.amount.toString()).toBe(line.quantityM3.mul(line.unitPrice).toDecimalPlaces(2).toString());
    expect(line.unitPrice.decimalPlaces()).toBeLessThanOrEqual(2);
  });

  it("yetkazish haqi faqat bir marta qo'shiladi", async () => {
    const prisma = {
      order: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'o1', externalRef: null, deliveryFee: new D(50_000) }) },
      invoice: { findUnique: jest.fn().mockResolvedValue({ id: 'i1', issuedAt: new Date() }), updateMany: jest.fn() },
    };
    await new BillingService(prisma as never).issueForOrder('o1');
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
  });
});
