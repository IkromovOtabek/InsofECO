import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { ClickWebhookController } from './click.controller';

const D = Prisma.Decimal;
const SECRET = 'click-secret';

function body(action: 0 | 1, over: Record<string, string> = {}) {
  const b: Record<string, string> = {
    click_trans_id: 'c1', service_id: 's1', merchant_trans_id: 'i1', amount: '100000.00', action: String(action), sign_time: '2026-10-05 10:00:00', error: '0',
    ...(action === 1 ? { merchant_prepare_id: 'i1' } : {}),
    ...over,
  };
  const base = `${b.click_trans_id}${b.service_id}${SECRET}${b.merchant_trans_id}${action === 1 ? b.merchant_prepare_id : ''}${b.amount}${b.action}${b.sign_time}`;
  b.sign_string = over.sign_string ?? createHash('md5').update(base).digest('hex');
  return b;
}

function mockPrisma(inv: Record<string, unknown> = {}) {
  const prisma: Record<string, any> = {
    invoice: {
      findUnique: jest.fn().mockResolvedValue({ id: 'i1', status: 'OPEN', amount: new D(150000), paidAmount: new D(50000), ...inv }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'i1', amount: new D(150000), paidAmount: new D(150000) }),
      update: jest.fn(),
    },
    payment: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}
const handle = (prisma: unknown, b: Record<string, string>) => new ClickWebhookController(prisma as never, {} as never).handle(b) as Promise<Record<string, unknown>>;

describe('Click webhook', () => {
  const env = { ...process.env };
  beforeEach(() => { process.env = { ...env, CLICK_SECRET_KEY: SECRET }; delete process.env.PAYMENTS_TEST_MODE; delete process.env.NODE_ENV; });
  afterAll(() => { process.env = env; });

  it("noto'g'ri imzo rad etiladi", async () => {
    expect((await handle(mockPrisma(), body(0, { sign_string: 'deadbeef' }))).error).toBe(-1);
  });
  it("CLICK_SECRET_KEY yo'q — fail closed (NODE_ENV'dan qat'i nazar)", async () => {
    delete process.env.CLICK_SECRET_KEY;
    expect((await handle(mockPrisma(), body(0))).error).toBe(-1);
    process.env.PAYMENTS_TEST_MODE = 'true';
    expect((await handle(mockPrisma(), body(0))).error).toBe(0);
  });
  it("summa so'mda qolgan qarzga teng bo'lishi shart (-2)", async () => {
    expect((await handle(mockPrisma(), body(0, { amount: '1.00' }))).error).toBe(-2);
    expect((await handle(mockPrisma(), body(0))).error).toBe(0);
  });
  it('PAID → -4, VOID → -9', async () => {
    expect((await handle(mockPrisma({ status: 'PAID' }), body(0))).error).toBe(-4);
    expect((await handle(mockPrisma({ status: 'VOID' }), body(1))).error).toBe(-9);
  });
  it("Complete: to'lov yoziladi, faktura PAID", async () => {
    const prisma = mockPrisma();
    const r = await handle(prisma, body(1));
    expect(r.error).toBe(0);
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    expect(prisma.invoice.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { status: 'PAID' } });
  });
  it("Complete takroriy: to'lov ikkinchi marta yozilmaydi, javob o'sha", async () => {
    const prisma = mockPrisma({ status: 'PAID', paidAmount: new D(150000) });
    prisma.payment.findUnique.mockResolvedValue({ id: 'p1', invoiceId: 'i1' });
    const r = await handle(prisma, body(1));
    expect(r).toMatchObject({ error: 0, merchant_confirm_id: 'i1' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('parallel to\'lov (optimistik qulf) — yozilmaydi', async () => {
    const prisma = mockPrisma();
    prisma.invoice.updateMany.mockResolvedValue({ count: 0 });
    expect((await handle(prisma, body(1))).error).toBe(-4);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
