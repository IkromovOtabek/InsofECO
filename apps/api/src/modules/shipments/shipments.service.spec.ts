import { Prisma } from '@prisma/client';
import { ShipmentsService } from './shipments.service';

const D = Prisma.Decimal;
const shipment = (over: Record<string, unknown> = {}) => ({
  id: 's1', number: 7, cargo: 'Sement', status: 'NEW', organizationId: 'org', projectId: 'p1', warehouseId: 'w1',
  driverUserId: null, driverFee: new D(100_000), quantity: new D(10),
  project: { id: 'p1', name: 'Uy', lat: null, lng: null }, request: null, payouts: [], ...over,
});

function setup(s: ReturnType<typeof shipment>, claimedCount: number, stockCount = 1) {
  const tx = {
    shipment: { updateMany: jest.fn().mockResolvedValue({ count: claimedCount }) },
    inventoryItem: { updateMany: jest.fn().mockResolvedValue({ count: stockCount }) }, materialRequest: { update: jest.fn() },
    expense: { create: jest.fn() }, project: { update: jest.fn() }, payout: { create: jest.fn() },
  };
  const prisma = {
    shipment: { findFirst: jest.fn().mockResolvedValue(s), count: jest.fn().mockResolvedValue(0) },
    user: { findUnique: jest.fn() }, membership: { findFirst: jest.fn().mockResolvedValue(null) },
    project: { count: jest.fn().mockResolvedValue(1) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const events = { emit: jest.fn() };
  return { svc: new ShipmentsService(prisma as never, events as never, { verifyKey: jest.fn(async (_u: string, k?: string) => k) } as never), tx, events };
}

describe('ShipmentsService.transition — poyga', () => {
  it('ikki haydovchi bir yukni olsa — ikkinchisi rad etiladi', async () => {
    const { svc, tx, events } = setup(shipment(), 0);
    await expect(svc.transition({ userId: 'd2', role: 'HAYDOVCHI', orgId: 'org', sessionId: 'x' }, 's1', { to: 'ACCEPTED' })).rejects.toThrow('boshqa haydovchi');
    expect(tx.shipment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 's1', status: 'NEW' }) }));
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('CONFIRMED ikki marta — ombor va haydovchi haqi ikkinchi marta yozilmaydi', async () => {
    const s = shipment({ status: 'DELIVERED', driverUserId: 'd1', request: { id: 'r1', materialId: 'm1', requestedByUserId: 'q1', material: { price: new D(5000) } } });
    const { svc, tx } = setup(s, 0);
    await expect(svc.transition({ userId: 't1', role: 'TADBIRKOR', orgId: 'org', sessionId: 'x' }, 's1', { to: 'CONFIRMED' })).rejects.toThrow();
    expect(tx.inventoryItem.updateMany).not.toHaveBeenCalled();
    expect(tx.payout.create).not.toHaveBeenCalled();
  });

  it('CONFIRMED birinchi marta — ombor QAYTA ayirilmaydi (tasdiqda band qilingan), haq va xarajat yoziladi', async () => {
    const s = shipment({ status: 'DELIVERED', driverUserId: 'd1', request: { id: 'r1', materialId: 'm1', requestedByUserId: 'q1', material: { price: new D(5000) } } });
    const { svc, tx } = setup(s, 1);
    await svc.transition({ userId: 't1', role: 'TADBIRKOR', orgId: 'org', sessionId: 'x' }, 's1', { to: 'CONFIRMED' });
    expect(tx.inventoryItem.updateMany).not.toHaveBeenCalled();
    expect(tx.materialRequest.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'CONFIRMED' } });
    expect(tx.payout.create).toHaveBeenCalledTimes(1);
    expect(tx.expense.create).toHaveBeenCalledTimes(2); // MATERIAL + DRIVER
  });

  it("CANCELLED — band qilingan zaxira omborga qaytadi, so'rov yana PENDING", async () => {
    const s = shipment({ status: 'NEW', request: { id: 'r1', materialId: 'm1', requestedByUserId: 'q1', material: { price: new D(5000) } } });
    const { svc, tx } = setup(s, 1);
    await svc.transition({ userId: 't1', role: 'TADBIRKOR', orgId: 'org', sessionId: 'x' }, 's1', { to: 'CANCELLED' });
    expect(tx.inventoryItem.updateMany).toHaveBeenCalledWith({ where: { warehouseId: 'w1', materialId: 'm1' }, data: { quantity: { increment: new D(10) } } });
    expect(tx.materialRequest.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'r1' }, data: expect.objectContaining({ status: 'PENDING' }) }));
    expect(tx.payout.create).not.toHaveBeenCalled();
  });
});
