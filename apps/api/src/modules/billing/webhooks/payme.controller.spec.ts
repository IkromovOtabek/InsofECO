import { Prisma } from '@prisma/client';
import { PaymeWebhookController } from './payme.controller';

const D = Prisma.Decimal;
const KEY = 'test-payme-key';
const AUTH = 'Basic ' + Buffer.from(`Paycom:${KEY}`).toString('base64');

type Rpc = { result?: Record<string, unknown>; error?: { code: number } };
const call = (prisma: unknown, method: string, params: Record<string, unknown>, auth: string | undefined = AUTH) =>
  new PaymeWebhookController(prisma as never, {} as never).handle({ id: 1, method, params }, auth) as Promise<Rpc>;

const invoice = (over: Record<string, unknown> = {}) => ({ id: 'i1', status: 'OPEN', amount: new D(150000), paidAmount: new D(50000), ...over });

/** $transaction(fn) — fn'ni shu mock bilan chaqiradi */
function mockPrisma(over: Record<string, unknown> = {}) {
  const prisma: Record<string, any> = {
    invoice: { findUnique: jest.fn().mockResolvedValue(invoice()), update: jest.fn() },
    payment: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    $queryRaw: jest.fn(),
    ...over,
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

describe('Payme webhook', () => {
  const env = { ...process.env };
  beforeEach(() => { process.env = { ...env, PAYME_KEY: KEY }; delete process.env.PAYMENTS_TEST_MODE; delete process.env.NODE_ENV; });
  afterAll(() => { process.env = env; });

  describe('autentifikatsiya', () => {
    it("noto'g'ri Basic auth rad etiladi (NODE_ENV'dan qat'i nazar)", async () => {
      const r = await call(mockPrisma(), 'CheckPerformTransaction', {}, 'Basic eHh4');
      expect(r.error?.code).toBe(-32504);
    });
    it("PAYME_KEY yo'q bo'lsa — fail closed (dev'da ham)", async () => {
      delete process.env.PAYME_KEY;
      process.env.NODE_ENV = 'development';
      const r = await call(mockPrisma(), 'CheckPerformTransaction', { account: { invoice_id: 'i1' }, amount: 10000000 }, undefined);
      expect(r.error?.code).toBe(-32504);
    });
    it('PAYMENTS_TEST_MODE=true va kalitsiz — o\'tkaziladi', async () => {
      delete process.env.PAYME_KEY;
      process.env.PAYMENTS_TEST_MODE = 'true';
      const r = await call(mockPrisma(), 'CheckPerformTransaction', { account: { invoice_id: 'i1' }, amount: 10000000 }, undefined);
      expect(r.result).toEqual({ allow: true });
    });
  });

  describe('summa va faktura holati', () => {
    it("summa tiyinda: qolgan qarz 100 000 so'm = 10 000 000 tiyin", async () => {
      expect((await call(mockPrisma(), 'CheckPerformTransaction', { account: { invoice_id: 'i1' }, amount: 10000000 })).result).toEqual({ allow: true });
      // so'mda yuborilgan summa (100 marta kam) — rad
      expect((await call(mockPrisma(), 'CheckPerformTransaction', { account: { invoice_id: 'i1' }, amount: 100000 })).error?.code).toBe(-31001);
    });
    it.each(['PAID', 'VOID'])('%s faktura rad etiladi', async (status) => {
      const prisma = mockPrisma({ invoice: { findUnique: jest.fn().mockResolvedValue(invoice({ status })) } });
      expect((await call(prisma, 'CheckPerformTransaction', { account: { invoice_id: 'i1' }, amount: 10000000 })).error?.code).toBe(-31051);
    });
    it("CreateTransaction noto'g'ri summa bilan to'lov yaratmaydi", async () => {
      const prisma = mockPrisma();
      const r = await call(prisma, 'CreateTransaction', { id: 'tx1', account: { invoice_id: 'i1' }, amount: 1 });
      expect(r.error?.code).toBe(-31001);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
    it('boshqa kutilayotgan tranzaksiya bo\'lsa — -31099', async () => {
      const prisma = mockPrisma();
      prisma.payment.findFirst.mockResolvedValue({ id: 'p0' });
      const r = await call(prisma, 'CreateTransaction', { id: 'tx1', account: { invoice_id: 'i1' }, amount: 10000000 });
      expect(r.error?.code).toBe(-31099);
    });
    it("to'g'ri summa — so'mda saqlanadi", async () => {
      const prisma = mockPrisma();
      prisma.payment.create.mockImplementation(({ data }: { data: { amount: Prisma.Decimal } }) => ({ id: 'p1', createdAt: new Date(5), ...data }));
      const r = await call(prisma, 'CreateTransaction', { id: 'tx1', account: { invoice_id: 'i1' }, amount: 10000000 });
      expect(r.result).toMatchObject({ transaction: 'p1', state: 1 });
      expect(prisma.payment.create.mock.calls[0][0].data.amount.toString()).toBe('100000');
    });
  });

  describe('PerformTransaction', () => {
    it("bekor qilingan tranzaksiya o'tkazilmaydi va fakturaga pul yozilmaydi", async () => {
      const prisma = mockPrisma();
      prisma.payment.findUnique.mockResolvedValue({ id: 'p1', status: 'CANCELLED', invoiceId: 'i1' });
      const r = await call(prisma, 'PerformTransaction', { id: 'tx1' });
      expect(r.error?.code).toBe(-31008);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
    it('takroriy chaqiruv: paidAmount oshmaydi, perform_time o\'zgarmaydi', async () => {
      const prisma = mockPrisma();
      const paidAt = new Date(1000);
      prisma.payment.findUnique.mockResolvedValue({ id: 'p1', status: 'CONFIRMED', invoiceId: 'i1', amount: new D(100000), paidAt });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({ id: 'p1', status: 'CONFIRMED', paidAt });
      const r1 = await call(prisma, 'PerformTransaction', { id: 'tx1' });
      const r2 = await call(prisma, 'PerformTransaction', { id: 'tx1' });
      expect(r1.result).toEqual({ transaction: 'p1', perform_time: 1000, state: 2 });
      expect(r2.result).toEqual(r1.result);
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
    it('poyga: updateMany 0 qaytarsa — faktura yangilanmaydi', async () => {
      const prisma = mockPrisma();
      prisma.payment.findUnique.mockResolvedValue({ id: 'p1', status: 'PENDING', invoiceId: 'i1', amount: new D(100000) });
      prisma.payment.updateMany.mockResolvedValue({ count: 0 });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({ id: 'p1', status: 'CONFIRMED', paidAt: new Date(7) });
      const r = await call(prisma, 'PerformTransaction', { id: 'tx1' });
      expect(r.result).toMatchObject({ state: 2, perform_time: 7 });
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('CancelTransaction', () => {
    it("o'tkazilgan to'lov bekor qilinmaydi (-31007)", async () => {
      const prisma = mockPrisma();
      prisma.payment.findUnique.mockResolvedValue({ id: 'p1', status: 'CONFIRMED' });
      expect((await call(prisma, 'CancelTransaction', { id: 'tx1' })).error?.code).toBe(-31007);
    });
    it('takroriy bekor qilish — bir xil cancel_time', async () => {
      const prisma = mockPrisma();
      prisma.payment.findUnique.mockResolvedValue({ id: 'p1', status: 'CANCELLED' });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({ id: 'p1', status: 'CANCELLED', paidAt: new Date(42) });
      const r = await call(prisma, 'CancelTransaction', { id: 'tx1' });
      expect(r.result).toEqual({ transaction: 'p1', cancel_time: 42, state: -1 });
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });
  });
});
