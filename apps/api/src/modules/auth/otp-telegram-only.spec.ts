import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { DomainError } from '../../common/errors/domain.error';

/**
 * Bir martalik kod FAQAT Telegram Gateway orqali (SMS yo'q) va javob har doim neytral:
 * Gateway yo'q / yetkaza olmadi / raqam tizimda yo'q — tashqaridan bir xil ko'rinadi.
 */

const KNOWN = '+998901112233';
const UNKNOWN = '+998909998877';
const NEUTRAL = { retryAfter: 60, channel: 'telegram' };

function setup(gateway: { enabled: boolean; sendCode?: jest.Mock }, allow = true) {
  const prisma = {
    otpCode: { create: jest.fn().mockResolvedValue({}) },
    user: { findUnique: jest.fn(async ({ where }: { where: { phone: string } }) => (where.phone === KNOWN ? { id: 'u1', phone: KNOWN } : null)) },
  };
  const redis = { allow: jest.fn().mockResolvedValue(allow), client: {} };
  const telegram = { enabled: gateway.enabled, sendCode: gateway.sendCode ?? jest.fn().mockResolvedValue(undefined) };
  const otp = new OtpService(prisma as never, redis as never, telegram as never);
  const auth = new AuthService(prisma as never, {} as never, otp, { emit: jest.fn() } as never, redis as never);
  return { otp, auth, prisma, redis, telegram };
}

describe('OTP — faqat Telegram, neytral javob', () => {
  const nodeEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = nodeEnv; });

  it('prod + Gateway: kod Telegram\'ga yuboriladi, javob neytral', async () => {
    process.env.NODE_ENV = 'production';
    const { otp, telegram, prisma } = setup({ enabled: true });
    await expect(otp.request(KNOWN, '1.1.1.1')).resolves.toEqual(NEUTRAL);
    expect(telegram.sendCode).toHaveBeenCalledWith(KNOWN, expect.stringMatching(/^\d{6}$/), expect.any(Number));
    expect(prisma.otpCode.create).toHaveBeenCalledTimes(1);
  });

  it('prod + Gateway rad etdi: xato emas, aynan shu neytral javob', async () => {
    process.env.NODE_ENV = 'production';
    const { otp } = setup({ enabled: true, sendCode: jest.fn().mockRejectedValue(new Error('PHONE_NUMBER_NOT_FOUND')) });
    await expect(otp.request(KNOWN, '1.1.1.1')).resolves.toEqual(NEUTRAL);
  });

  it('prod + Gateway sozlanmagan: kod yaratilmaydi, javob neytral', async () => {
    process.env.NODE_ENV = 'production';
    const { otp, prisma, telegram } = setup({ enabled: false });
    await expect(otp.request(KNOWN, '1.1.1.1')).resolves.toEqual(NEUTRAL);
    expect(prisma.otpCode.create).not.toHaveBeenCalled();
    expect(telegram.sendCode).not.toHaveBeenCalled();
  });

  it('dev (Gateway yo\'q): hech narsa yuborilmaydi, kod 000000', async () => {
    process.env.NODE_ENV = 'development';
    const { otp, prisma, telegram } = setup({ enabled: false });
    await expect(otp.request(KNOWN, '1.1.1.1')).resolves.toEqual(NEUTRAL);
    expect(telegram.sendCode).not.toHaveBeenCalled();
    expect(prisma.otpCode.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Gateway ishlaydi', { enabled: true }],
    ['Gateway rad etadi', { enabled: true, sendCode: jest.fn().mockRejectedValue(new Error('x')) }],
    ['Gateway yo\'q', { enabled: false }],
  ])('parolni tiklash: mavjud va noma\'lum raqamga bir xil javob (%s)', async (_n, gw) => {
    process.env.NODE_ENV = 'production';
    const { auth } = setup(gw);
    const known = await auth.forgotPassword(KNOWN, '1.1.1.1');
    const unknown = await auth.forgotPassword(UNKNOWN, '1.1.1.1');
    expect(known).toEqual(NEUTRAL);
    expect(unknown).toEqual(known);
  });

  it('parolni tiklash: soatlik chek noma\'lum raqamga ham bir xil qo\'llanadi', async () => {
    const { auth } = setup({ enabled: true }, false);
    const e1 = await auth.forgotPassword(KNOWN, '1.1.1.1').catch((e: DomainError) => e.code);
    const e2 = await auth.forgotPassword(UNKNOWN, '1.1.1.1').catch((e: DomainError) => e.code);
    expect(e1).toBe('AUTH_OTP_RATE_LIMIT');
    expect(e2).toBe(e1);
  });
});
