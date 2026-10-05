import { AppVersionMiddleware, isExemptPath, parseSemver, semverLt } from './app-version.middleware';

function run(mw: AppVersionMiddleware, url: string, headers: Record<string, string>) {
  const req = { originalUrl: url, url, header: (k: string) => headers[k.toLowerCase()] };
  const res = { statusCode: 200, body: undefined as unknown, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  const next = jest.fn();
  return mw.use(req as never, res as never, next).then(() => ({ res, next }));
}

const prismaWith = (rows: { key: string; value: unknown }[]) => ({ appConfig: { findMany: jest.fn().mockResolvedValue(rows) } });

describe('semver', () => {
  it('taqqoslaydi', () => {
    expect(semverLt(parseSemver('1.0.1')!, parseSemver('1.0.2')!)).toBe(true);
    expect(semverLt(parseSemver('1.10.0')!, parseSemver('1.9.9')!)).toBe(false);
    expect(semverLt(parseSemver('v2')!, parseSemver('2.0.0')!)).toBe(false);
    expect(parseSemver('abc')).toBeNull();
  });
  it('ochiq yo\'llar', () => {
    expect(isExemptPath('/v1/health')).toBe(true);
    expect(isExemptPath('/v1/auth/refresh')).toBe(true);
    expect(isExemptPath('/v1/app-config?x=1')).toBe(true);
    expect(isExemptPath('/v1/catalog/plants/1/mixes')).toBe(true);
    expect(isExemptPath('/v1/auth/login')).toBe(false);
    expect(isExemptPath('/v1/deliveries')).toBe(false);
  });
});

describe('AppVersionMiddleware', () => {
  it('app.min_version o\'rnatilmagan — hech kim bloklanmaydi', async () => {
    const { res, next } = await run(new AppVersionMiddleware(prismaWith([]) as never), '/v1/deliveries', { 'x-app-version': '0.0.1', 'x-app-platform': 'android' });
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('past versiya — 426 APP_UPDATE_REQUIRED va platformaga mos havola', async () => {
    const prisma = prismaWith([
      { key: 'app.min_version', value: { android: '1.0.2', ios: '1.0.0' } },
      { key: 'app.update_url', value: { android: 'https://play.google.com/store/apps/details?id=uz.insof', ios: 'https://apps.apple.com/x' } },
    ]);
    const mw = new AppVersionMiddleware(prisma as never);
    const { res, next } = await run(mw, '/v1/deliveries', { 'x-app-version': '1.0.1', 'x-app-platform': 'android' });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(426);
    expect(res.body).toMatchObject({ code: 'APP_UPDATE_REQUIRED', updateUrl: 'https://play.google.com/store/apps/details?id=uz.insof', details: { minVersion: '1.0.2' } });

    // iOS'da 1.0.1 yetarli; sarlavhasiz (ERP/veb) va ochiq yo'llar o'tadi; sozlama keshlanadi
    expect((await run(mw, '/v1/deliveries', { 'x-app-version': '1.0.1', 'x-app-platform': 'ios' })).next).toHaveBeenCalled();
    expect((await run(mw, '/v1/deliveries', {})).next).toHaveBeenCalled();
    expect((await run(mw, '/v1/auth/refresh', { 'x-app-version': '0.1.0', 'x-app-platform': 'android' })).next).toHaveBeenCalled();
    expect((await run(mw, '/v1/health', { 'x-app-version': '0.1.0', 'x-app-platform': 'android' })).next).toHaveBeenCalled();
    expect(prisma.appConfig.findMany).toHaveBeenCalledTimes(1);
  });

  it('teng yoki yuqori versiya o\'tadi', async () => {
    const mw = new AppVersionMiddleware(prismaWith([{ key: 'app.min_version', value: '1.0.2' }]) as never);
    expect((await run(mw, '/v1/orders', { 'x-app-version': '1.0.2' })).next).toHaveBeenCalled();
    expect((await run(mw, '/v1/orders', { 'x-app-version': '1.1.0' })).next).toHaveBeenCalled();
  });
});
