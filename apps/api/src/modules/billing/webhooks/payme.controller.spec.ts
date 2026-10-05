import { PaymeWebhookController } from './payme.controller';

describe('Payme PerformTransaction', () => {
  it("bekor qilingan tranzaksiya o'tkazilmaydi va fakturaga pul yozilmaydi", async () => {
    const prisma = { payment: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', status: 'CANCELLED', invoiceId: 'i1' }) }, $transaction: jest.fn() };
    const r = (await new PaymeWebhookController(prisma as never, {} as never).handle({ id: 1, method: 'PerformTransaction', params: { id: 'tx1' } })) as { error?: { code: number } };
    expect(r.error?.code).toBe(-31008);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
