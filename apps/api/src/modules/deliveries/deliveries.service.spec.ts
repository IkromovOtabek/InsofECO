import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { DeliveriesService, clampClientTime } from './deliveries.service';

const D = Prisma.Decimal;
const NOW = new Date();
const DRIVER = { userId: 'h1', role: 'HAYDOVCHI' as const, orgId: null, sessionId: 's' };
const PLANT = { userId: 't1', role: 'TADBIRKOR' as const, orgId: 'plant', sessionId: 's' };
const CLIENT = { userId: 'q1', role: 'QURUVCHI' as const, orgId: 'client', sessionId: 's' };

const delivery = (over: Record<string, unknown> = {}) => ({
  id: 'd1', orderId: 'o1', sequence: 1, status: 'UNLOADING', plannedM3: new D(8), loadedM3: new D(8), acceptedM3: null,
  driverId: 'dp1', vehicleId: 'v1', acceptOtpHash: null, acceptOtpExpiresAt: null, acceptOtpAttempts: 0,
  order: { id: 'o1', number: 1, address: 'A', lat: 41, lng: 69, plantOrgId: 'plant', clientOrgId: 'client', needsPump: false, client: { name: 'C' }, items: [] },
  driver: { id: 'dp1', userId: 'h1', user: { id: 'h1', fullName: 'H', phone: '+998' } },
  vehicle: { id: 'v1', capacityM3: new D(8) },
  events: [],
  ...over,
});

function setup(d: ReturnType<typeof delivery>) {
  const tx = {
    delivery: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue(d) },
    deliveryEvent: { create: jest.fn() },
  };
  const prisma = {
    delivery: { findFirst: jest.fn().mockResolvedValue(d), count: jest.fn().mockResolvedValue(0), updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
    deliveryEvent: { findUnique: jest.fn().mockResolvedValue(null) },
    membership: { count: jest.fn().mockResolvedValue(1), findFirst: jest.fn() },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const orders = { systemTransition: jest.fn(), rules: jest.fn().mockResolvedValue({ concreteMaxTransitMinutes: 90 }) };
  const svc = new DeliveriesService(
    prisma as never,
    { emit: jest.fn() } as never,
    orders as never,
    { enabled: false } as never,
    { add: jest.fn() } as never,
    { verifyKey: jest.fn(async (_u: string, k?: string) => k), verifyKeys: jest.fn(async () => []) } as never,
  );
  return { svc, prisma, tx, orders };
}

describe('DeliveriesService.transition — yakunlash faqat imzo bilan', () => {
  it.each([CLIENT, PLANT])('UNLOADING → COMPLETED /transition orqali ($role) rad etiladi', async (a) => {
    const { svc, tx } = setup(delivery());
    await expect(svc.transition(a, 'd1', { to: 'COMPLETED', at: NOW })).rejects.toMatchObject({ code: 'DELIVERY_SIGNATURE_REQUIRED' });
    expect(tx.delivery.updateMany).not.toHaveBeenCalled();
  });

  it("DISPUTED → COMPLETED: acceptedM3 majburiy va yuklangandan oshmasin", async () => {
    const { svc, tx } = setup(delivery({ status: 'DISPUTED' }));
    await expect(svc.transition(PLANT, 'd1', { to: 'COMPLETED', at: NOW })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(svc.transition(PLANT, 'd1', { to: 'COMPLETED', at: NOW, acceptedM3: 50 })).rejects.toMatchObject({ code: 'VALIDATION' });
    await svc.transition(PLANT, 'd1', { to: 'COMPLETED', at: NOW, acceptedM3: 6 });
    expect(tx.delivery.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', acceptedM3: new D(6) }) }));
  });

  it("yuklangan hajm mashina sig'imidan oshsa — rad", async () => {
    const { svc } = setup(delivery({ status: 'LOADING' }));
    await expect(svc.transition(DRIVER, 'd1', { to: 'EN_ROUTE', at: NOW, loadedM3: 12 })).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it("faol bo'lmagan haydovchi (a'zoligi o'chirilgan) reysni boshqara olmaydi", async () => {
    const { svc, prisma } = setup(delivery({ status: 'LOADING' }));
    prisma.membership.count.mockResolvedValue(0);
    await expect(svc.transition(DRIVER, 'd1', { to: 'EN_ROUTE', at: NOW })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('oxirgi reys FAILED, boshqasi yetkazilgan — buyurtma DELIVERED', async () => {
    const { svc, prisma, orders } = setup(delivery({ status: 'EN_ROUTE' }));
    prisma.delivery.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1); // ochiq=0, yakunlangan=1
    await svc.transition(DRIVER, 'd1', { to: 'FAILED', at: NOW });
    expect(orders.systemTransition).toHaveBeenCalledWith('o1', 'DELIVERED', 'h1');
  });

  it('hamma reys FAILED/CANCELLED, birortasi ham yetkazilmagan — buyurtma CANCELLED', async () => {
    const { svc, prisma, orders } = setup(delivery({ status: 'EN_ROUTE' }));
    prisma.delivery.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    await svc.transition(DRIVER, 'd1', { to: 'FAILED', at: NOW });
    expect(orders.systemTransition).toHaveBeenCalledWith('o1', 'CANCELLED', 'h1');
  });
});

describe('DeliveriesService.sign — qabul kodi', () => {
  const fresh = new Date(Date.now() + 10 * 60_000);

  it('muddati tugagan kod — rad, urinish hisoblanmaydi', async () => {
    const { svc, prisma } = setup(delivery({ acceptOtpHash: 'x', acceptOtpExpiresAt: new Date(Date.now() - 1000) }));
    await expect(svc.sign(DRIVER, 'd1', { otpCode: '123456', acceptedM3: 8 })).rejects.toMatchObject({ code: 'AUTH_OTP_EXPIRED' });
    expect(prisma.delivery.updateMany).not.toHaveBeenCalled();
  });

  it('5 urinish tugagan — argon2 tekshiruvigacha bormaydi', async () => {
    const hash = await argon2.hash('123456');
    const { svc, prisma, tx } = setup(delivery({ acceptOtpHash: hash, acceptOtpExpiresAt: fresh, acceptOtpAttempts: 5 }));
    prisma.delivery.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.sign(DRIVER, 'd1', { otpCode: '123456', acceptedM3: 8 })).rejects.toMatchObject({ code: 'AUTH_OTP_INVALID' });
    expect(tx.delivery.updateMany).not.toHaveBeenCalled();
  });

  it("noto'g'ri kod — urinish OLDIN atomar oshiriladi, reys yakunlanmaydi", async () => {
    const hash = await argon2.hash('123456');
    const { svc, prisma, tx } = setup(delivery({ acceptOtpHash: hash, acceptOtpExpiresAt: fresh }));
    await expect(svc.sign(DRIVER, 'd1', { otpCode: '000000', acceptedM3: 8 })).rejects.toMatchObject({ code: 'DELIVERY_SIGNATURE_REQUIRED' });
    expect(prisma.delivery.updateMany).toHaveBeenCalledWith({ where: { id: 'd1', acceptOtpAttempts: { lt: 5 } }, data: { acceptOtpAttempts: { increment: 1 } } });
    expect(tx.delivery.updateMany).not.toHaveBeenCalled();
  });

  it("to'g'ri kod — yakunlanadi, kod va muddati tozalanadi", async () => {
    const hash = await argon2.hash('123456');
    const { svc, tx } = setup(delivery({ acceptOtpHash: hash, acceptOtpExpiresAt: fresh }));
    await svc.sign(DRIVER, 'd1', { otpCode: '123456', acceptedM3: 7.5 });
    expect(tx.delivery.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', acceptedM3: new D(7.5), acceptOtpHash: null, acceptOtpExpiresAt: null }) }));
  });

  it('quruvchi imzosiz yakunlay olmaydi', async () => {
    const { svc } = setup(delivery());
    await expect(svc.sign(CLIENT, 'd1', { acceptedM3: 8 } as never)).rejects.toMatchObject({ code: 'DELIVERY_SIGNATURE_REQUIRED' });
  });
});

describe('clampClientTime', () => {
  const now = new Date('2026-10-16T10:00:00Z');
  it('kelajak → hozir', () => expect(clampClientTime(new Date('2026-10-16T11:00:00Z'), now)).toEqual(now));
  it("oflayn navbat (3 soat oldin) — o'z vaqti qoladi", () => {
    const at = new Date('2026-10-16T07:00:00Z');
    expect(clampClientTime(at, now)).toEqual(at);
  });
  it('24 soatdan eski → 24 soat chegarasi', () => expect(clampClientTime(new Date('2026-10-01T00:00:00Z'), now)).toEqual(new Date('2026-10-15T10:00:00Z')));
});
