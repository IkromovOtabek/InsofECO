import { firstValueFrom, of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

function ctx(req: Record<string, unknown>) {
  const res = { statusCode: 200, status: jest.fn(), setHeader: jest.fn() };
  return { ctx: { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as never, res };
}

function redis(over: Partial<{ get: unknown; set: unknown }> = {}) {
  const exec = jest.fn().mockResolvedValue([]);
  const multi = { set: jest.fn(), del: jest.fn(), exec };
  multi.set.mockReturnValue(multi); multi.del.mockReturnValue(multi);
  const client = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK'), del: jest.fn().mockResolvedValue(1), multi: jest.fn(() => multi), ...over };
  return { client, multi };
}

const req = (over: Record<string, unknown> = {}) => ({ method: 'POST', path: '/v1/deliveries/d1/transition', headers: { 'idempotency-key': 'k1' }, auth: { userId: 'u1' }, ...over });

describe('IdempotencyInterceptor', () => {
  it('@Public (auth yo\'q) so\'rov keshlanmaydi — login javobidagi token kalit bilan qaytarilmaydi', async () => {
    const r = redis();
    const { ctx: c } = ctx(req({ auth: undefined, path: '/v1/auth/login' }));
    const out = await firstValueFrom(new IdempotencyInterceptor({ client: r.client } as never).intercept(c, { handle: () => of({ accessToken: 't' }) }));
    expect(out).toEqual({ accessToken: 't' });
    expect(r.client.get).not.toHaveBeenCalled();
  });

  it('kalit foydalanuvchi + metod + yo\'lga bog\'lanadi va qulf olinadi', async () => {
    const r = redis();
    const { ctx: c } = ctx(req());
    await firstValueFrom(new IdempotencyInterceptor({ client: r.client } as never).intercept(c, { handle: () => of({ ok: 1 }) }));
    const key = 'idem:u1:POST:/v1/deliveries/d1/transition:k1';
    expect(r.client.get).toHaveBeenCalledWith(key);
    expect(r.client.set).toHaveBeenCalledWith(`${key}:lock`, '1', 'EX', 30, 'NX');
    expect(r.multi.set).toHaveBeenCalledWith(key, expect.any(String), 'EX', 24 * 3600);
    expect(r.multi.del).toHaveBeenCalledWith(`${key}:lock`);
  });

  it('parallel takror (qulf band) — 409, handler chaqirilmaydi', async () => {
    const r = redis({ set: jest.fn().mockResolvedValue(null) });
    const { ctx: c } = ctx(req());
    const handle = jest.fn(() => of({ ok: 1 }));
    await expect(firstValueFrom(new IdempotencyInterceptor({ client: r.client } as never).intercept(c, { handle }))).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(handle).not.toHaveBeenCalled();
  });

  it('keshlangan javob qaytariladi (Idempotent-Replayed)', async () => {
    const r = redis({ get: jest.fn().mockResolvedValue(JSON.stringify({ status: 201, body: { id: 'x' } })) });
    const { ctx: c, res } = ctx(req());
    const handle = jest.fn(() => of({ id: 'new' }));
    const out = await firstValueFrom(new IdempotencyInterceptor({ client: r.client } as never).intercept(c, { handle }));
    expect(out).toEqual({ id: 'x' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.setHeader).toHaveBeenCalledWith('Idempotent-Replayed', 'true');
    expect(handle).not.toHaveBeenCalled();
  });
});
