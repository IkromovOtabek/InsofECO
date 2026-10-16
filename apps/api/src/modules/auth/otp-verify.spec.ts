import * as argon2 from 'argon2';
import { OtpService } from './otp.service';

/** Kodni tekshirish: urinishlar argon2'dan OLDIN atomar hisoblanadi, kod bir martalik. */
describe('OtpService.verify — poyga', () => {
  const fresh = () => new Date(Date.now() + 5 * 60_000);
  function setup(otp: Record<string, unknown>, claimed = 1, used = 1) {
    const prisma = {
      otpCode: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', attempts: 0, usedAt: null, expiresAt: fresh(), ...otp }),
        updateMany: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ count: 'usedAt' in data ? used : claimed })),
      },
    };
    return { svc: new OtpService(prisma as never, {} as never, { enabled: false } as never), prisma };
  }

  it('urinishlar tugagan (parallel so\'rovlar) — argon2 chaqirilmaydi', async () => {
    // codeHash yaroqsiz: argon2.verify chaqirilsa boshqa xato (TypeError) bo'lardi — demak unga yetib bormaydi
    const { svc, prisma } = setup({ codeHash: 'not-a-hash' }, 0);
    await expect(svc.verify('+998', '123456')).rejects.toMatchObject({ code: 'AUTH_OTP_INVALID', message: expect.stringContaining('Urinishlar') });
    expect(prisma.otpCode.updateMany).toHaveBeenCalledTimes(1);
  });

  it("noto'g'ri kod — urinish oshirilgan, usedAt yozilmaydi", async () => {
    const { svc, prisma } = setup({ codeHash: await argon2.hash('123456') });
    await expect(svc.verify('+998', '000000')).rejects.toMatchObject({ code: 'AUTH_OTP_INVALID' });
    expect(prisma.otpCode.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({ where: { id: 'c1', usedAt: null, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
  });

  it("to'g'ri kod ikki marta parallel — ikkinchisi rad (bir martalik)", async () => {
    const { svc } = setup({ codeHash: await argon2.hash('123456') }, 1, 0);
    await expect(svc.verify('+998', '123456')).rejects.toMatchObject({ code: 'AUTH_OTP_INVALID' });
  });

  it("to'g'ri kod — o'tadi", async () => {
    const { svc } = setup({ codeHash: await argon2.hash('123456') });
    await expect(svc.verify('+998', '123456')).resolves.toBeUndefined();
  });
});
