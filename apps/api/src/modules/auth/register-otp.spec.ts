import { AuthService } from './auth.service';
import { OtpService } from './otp.service';

/** Xotiradagi Redis o'rnini bosuvchi: faqat set/get/multi().get().del().exec(). */
function fakeRedis() {
  const store = new Map<string, string>();
  const client = {
    set: jest.fn(async (k: string, v: string) => { store.set(k, v); return 'OK'; }),
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    multi: () => {
      const ops: (() => unknown)[] = [];
      const m = {
        get: (k: string) => { ops.push(() => store.get(k) ?? null); return m; },
        del: (k: string) => { ops.push(() => (store.delete(k) ? 1 : 0)); return m; },
        exec: async () => ops.map((op) => [null, op()]),
      };
      return m;
    },
  };
  return { client, allow: jest.fn().mockResolvedValue(true), store };
}

const device = { deviceId: 'device-123456', platform: 'android' as const };
const input = { fullName: 'Ali Valiyev', phone: '+998901234567', password: 'secret123', role: 'QURUVCHI' as const, device };

function setup() {
  const redis = fakeRedis();
  const otp = new OtpService({} as never, redis as never, {} as never, { enabled: false } as never);
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
    organization: { findFirst: jest.fn() },
    $transaction: jest.fn().mockRejectedValue(new Error('TX_REACHED')),
  };
  const svc = new AuthService(prisma as never, {} as never, otp, { emit: jest.fn() } as never, redis as never);
  return { svc, otp, prisma, redis };
}

describe("Ro'yxatdan o'tish — telefon egaligi (REGISTER_OTP_REQUIRED)", () => {
  const env = process.env.REGISTER_OTP_REQUIRED;
  afterEach(() => { if (env === undefined) delete process.env.REGISTER_OTP_REQUIRED; else process.env.REGISTER_OTP_REQUIRED = env; });

  it('sukut bo\'yicha tokensiz so\'rov rad etiladi', async () => {
    delete process.env.REGISTER_OTP_REQUIRED;
    const { svc, prisma } = setup();
    await expect(svc.register(input)).rejects.toMatchObject({ code: 'AUTH_OTP_INVALID', details: { reason: 'PHONE_NOT_VERIFIED' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('REGISTER_OTP_REQUIRED=false — eski ilova (tokensiz) o\'tadi', async () => {
    process.env.REGISTER_OTP_REQUIRED = 'false';
    const { svc } = setup();
    await expect(svc.register(input)).rejects.toThrow('TX_REACHED');
  });

  it('boshqa raqamga berilgan token ishlamaydi', async () => {
    const { svc, otp } = setup();
    const token = await otp.issuePhoneToken('+998909999999', 'register');
    await expect(svc.register({ ...input, phoneVerificationToken: token })).rejects.toMatchObject({ code: 'AUTH_OTP_INVALID' });
  });

  it('token bir martalik', async () => {
    const { svc, otp } = setup();
    const token = await otp.issuePhoneToken(input.phone, 'register');
    await expect(svc.register({ ...input, phoneVerificationToken: token })).rejects.toThrow('TX_REACHED');
    await expect(svc.register({ ...input, phoneVerificationToken: token })).rejects.toMatchObject({ code: 'AUTH_OTP_INVALID' });
  });

  it('mavjud raqam token bilan ham rad etiladi (egasi kod bilan kiradi)', async () => {
    const { svc, otp, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', phone: input.phone, passwordHash: null, blockedAt: null });
    const token = await otp.issuePhoneToken(input.phone, 'register');
    await expect(svc.register({ ...input, phoneVerificationToken: token })).rejects.toMatchObject({ code: 'AUTH_PHONE_TAKEN' });
  });

  it('redisda token emas, xeshi saqlanadi', async () => {
    const { otp, redis } = setup();
    const token = await otp.issuePhoneToken(input.phone, 'register');
    expect([...redis.store.keys()].some((k) => k.includes(token))).toBe(false);
  });
});
