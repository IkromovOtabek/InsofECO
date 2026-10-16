import { JwtAuthGuard } from './jwt-auth.guard';
import { invalidateUserGate } from './user-gate';

function run(path: string, headers: Record<string, string>) {
  const prisma = {
    integrationClient: { findUnique: jest.fn().mockResolvedValue({ id: 'ic1', userId: 'svc', organizationId: 'org', name: 'ERP', isActive: true }), update: jest.fn().mockResolvedValue({}) },
    user: { findUnique: jest.fn().mockResolvedValue({ blockedAt: null, deletedAt: null, tokensValidAfter: null }) },
  };
  const req: Record<string, unknown> = { path, headers };
  const ctx = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => req }) } as never;
  const guard = new JwtAuthGuard({ getAllAndOverride: () => false } as never, {} as never, prisma as never);
  return { ok: guard.canActivate(ctx), prisma, req };
}

describe('JwtAuthGuard — X-Api-Key faqat /erp/*', () => {
  beforeEach(() => invalidateUserGate('svc')); // user-gate keshi (30 s) testlar orasida tozalanadi
  it('/v1/erp/trips — kalit qabul qilinadi', async () => {
    const { ok, req } = run('/v1/erp/trips', { 'x-api-key': 'k' });
    await expect(ok).resolves.toBe(true);
    expect((req.auth as { integration?: unknown }).integration).toBeTruthy();
  });

  it('/v1/orders — kalit bilan kirib bo\'lmaydi (baza so\'ralmaydi ham)', async () => {
    const { ok, prisma } = run('/v1/orders', { 'x-api-key': 'k' });
    await expect(ok).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.integrationClient.findUnique).not.toHaveBeenCalled();
  });

  it('/v1/erpx — prefiks o\'xshash, lekin boshqa yo\'l — rad', async () => {
    await expect(run('/v1/erpx/trips', { 'x-api-key': 'k' }).ok).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('kalit egasi bloklangan — kalit ham ishlamaydi', async () => {
    const { ok, prisma } = run('/v1/erp/trips', { 'x-api-key': 'k' });
    prisma.user.findUnique.mockResolvedValue({ blockedAt: new Date(), deletedAt: null, tokensValidAfter: null });
    await expect(ok).rejects.toMatchObject({ code: 'AUTH_TOKEN_INVALID' });
  });
});
