import { Prisma } from '@prisma/client';
import { MaterialsService } from './materials.service';

const D = Prisma.Decimal;
const a = { userId: 't1', role: 'TADBIRKOR' as const, orgId: 'org', sessionId: 'x' };

function setup(opts: { member?: unknown; vehicle?: unknown } = {}) {
  const prisma = {
    materialRequest: { findFirst: jest.fn().mockResolvedValue({ id: 'r1', number: 1, status: 'PENDING', materialId: 'm1', quantity: new D(5), projectId: 'p1', requestedByUserId: 'q1', material: { name: 'Sement', unit: 'qop' }, project: { lat: null, lng: null } }) },
    membership: { findFirst: jest.fn().mockResolvedValue(opts.member ?? null) },
    vehicle: { findFirst: jest.fn().mockResolvedValue(opts.vehicle ?? null) },
    warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', lat: null, lng: null }) },
    inventoryItem: { findUnique: jest.fn().mockResolvedValue({ quantity: new D(100) }) },
    $transaction: jest.fn(),
  };
  return { svc: new MaterialsService(prisma as never, { emit: jest.fn() } as never), prisma };
}

describe('MaterialsService.approve — IDOR', () => {
  it('begona tashkilot haydovchisi — rad etiladi, yuk yaratilmaydi', async () => {
    const { svc, prisma } = setup();
    await expect(svc.approve(a, 'r1', { driverUserId: 'foreign' } as never)).rejects.toThrow();
    expect(prisma.membership.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'foreign', organizationId: 'org', role: 'HAYDOVCHI', isActive: true } }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('begona tashkilot mashinasi — rad etiladi', async () => {
    const { svc, prisma } = setup({ member: { id: 'm' } });
    await expect(svc.approve(a, 'r1', { driverUserId: 'd1', vehicleId: 'v-foreign' } as never)).rejects.toThrow();
    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'v-foreign', organizationId: 'org' } }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('MaterialsService.approve — zaxira tasdiqda atomar band qilinadi', () => {
  function setupTx(taken: number) {
    const base = setup({ member: { id: 'm' }, vehicle: { id: 'v1' } });
    const tx = {
      materialRequest: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue({ shipment: { id: 's1' } }) },
      inventoryItem: { updateMany: jest.fn().mockResolvedValue({ count: taken }) },
      shipment: { create: jest.fn().mockResolvedValue({ id: 's1' }) },
    };
    base.prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    return { ...base, tx };
  }

  it('zaxira yetarli — shartli ayiriladi (quantity >= miqdor), yuk yaratiladi', async () => {
    const { svc, tx } = setupTx(1);
    await svc.approve(a, 'r1', { driverUserId: 'd1', vehicleId: 'v1' } as never);
    expect(tx.inventoryItem.updateMany).toHaveBeenCalledWith({ where: { warehouseId: 'w1', materialId: 'm1', quantity: { gte: new D(5) } }, data: { quantity: { decrement: new D(5) } } });
    expect(tx.shipment.create).toHaveBeenCalledTimes(1);
  });

  it('parallel tasdiq zaxirani tugatgan — xato, yuk yaratilmaydi', async () => {
    const { svc, tx } = setupTx(0);
    await expect(svc.approve(a, 'r1', { driverUserId: 'd1', vehicleId: 'v1' } as never)).rejects.toThrow('yetarli emas');
    expect(tx.shipment.create).not.toHaveBeenCalled();
  });
});
