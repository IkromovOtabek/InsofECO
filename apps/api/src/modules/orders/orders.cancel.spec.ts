import { Prisma } from '@prisma/client';
import { OrdersService } from './orders.service';

const D = Prisma.Decimal;
const CLIENT = { userId: 'q1', role: 'QURUVCHI' as const, orgId: 'client', sessionId: 's' };

/** Bekor qilish: "reys boshlanganmi" tekshiruvi TRANZAKSIYA ICHIDA ham bo'lishi shart (TOCTOU). */
describe('OrdersService.cancel — poyga', () => {
  function setup(startedInTx: number) {
    const tx = {
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue({ id: 'o1', plantOrgId: 'plant', clientOrgId: 'client' }) },
      delivery: { count: jest.fn().mockResolvedValue(startedInTx), updateMany: jest.fn() },
    };
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue({ id: 'o1', status: 'CONFIRMED', plantOrgId: 'plant', clientOrgId: 'client', totalAmount: new D(100), scheduledAt: new Date(Date.now() + 86_400_000), deliveries: [] }) },
      organization: { findUnique: jest.fn().mockResolvedValue({ settings: {} }) },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const events = { emit: jest.fn() };
    return { svc: new OrdersService(prisma as never, events as never), tx, events };
  }

  it('tekshiruvdan keyin haydovchi yuklashni boshlagan — bekor qilish rad, reyslar o\'chirilmaydi', async () => {
    const { svc, tx, events } = setup(1);
    await expect(svc.cancel(CLIENT, 'o1')).rejects.toMatchObject({ code: 'ORDER_INVALID_TRANSITION' });
    expect(tx.delivery.updateMany).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('reys boshlanmagan — bekor, kutayotgan reyslar ham yopiladi', async () => {
    const { svc, tx } = setup(0);
    await svc.cancel(CLIENT, 'o1');
    expect(tx.delivery.updateMany).toHaveBeenCalledWith({ where: { orderId: 'o1', status: { in: ['ASSIGNED', 'DECLINED', 'ACCEPTED'] } }, data: { status: 'CANCELLED' } });
  });
});
