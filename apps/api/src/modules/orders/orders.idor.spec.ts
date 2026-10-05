import { OrdersService } from './orders.service';

const a = { userId: 't1', role: 'TADBIRKOR' as const, orgId: 'plant1', sessionId: 'x' };
const input = { plantOrgId: 'plant1', items: [{ mixId: 'mx', volumeM3: 5 }], address: 'x', location: { lat: 0, lng: 0 }, scheduledAt: new Date(Date.now() + 86_400_000) } as never;

function setup(over: Record<string, unknown> = {}) {
  const prisma = {
    organization: { findFirst: jest.fn().mockResolvedValue(null) },
    order: { findFirst: jest.fn().mockResolvedValue(null) },
    concreteMix: { findMany: jest.fn() },
    $transaction: jest.fn(),
    ...over,
  };
  return { svc: new OrdersService(prisma as never, { emit: jest.fn() } as never), prisma };
}

describe('OrdersService — IDOR', () => {
  it('on-behalf: zavod mijozi bo\'lmagan tashkilot — rad etiladi', async () => {
    const { svc, prisma } = setup();
    await expect(svc.createOnBehalf(a, input, 'stranger')).rejects.toThrow();
    expect(prisma.organization.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'stranger', OR: [{ ordersAsClient: { some: { plantOrgId: 'plant1' } } }, { creditLimits: { some: { plantOrgId: 'plant1' } } }] }),
    }));
    expect(prisma.concreteMix.findMany).not.toHaveBeenCalled();
  });

  it('on-behalf: boshqa zavod nomidan — rad etiladi', async () => {
    const { svc, prisma } = setup();
    await expect(svc.createOnBehalf(a, { ...(input as object), plantOrgId: 'plant2' } as never, 'c1')).rejects.toThrow();
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('reject: mijoz tomonidagi TADBIRKOR (zavod emas) — rad etiladi', async () => {
    const { svc, prisma } = setup({ order: { findFirst: jest.fn().mockResolvedValue({ id: 'o1', plantOrgId: 'plant9', clientOrgId: 'plant1', status: 'SUBMITTED' }) } });
    await expect(svc.reject(a, 'o1', 'yo\'q')).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
