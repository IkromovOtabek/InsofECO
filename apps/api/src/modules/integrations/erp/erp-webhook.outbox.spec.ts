import { backoffMs, MAX_ATTEMPTS, retryable } from './erp-webhook.outbox';

describe('ERP webhook navbati', () => {
  it('kutish o\'sib boradi va soatda to\'xtaydi', () => {
    expect(backoffMs(1)).toBe(5_000);
    expect(backoffMs(2)).toBe(30_000);
    expect(backoffMs(6)).toBe(1_800_000);
    expect(backoffMs(7)).toBe(3_600_000);
    expect(backoffMs(MAX_ATTEMPTS)).toBe(3_600_000);
  });

  it('jami urinish muddati ERP\'ning bir necha soatlik uzilishini qoplaydi', () => {
    let total = 0;
    for (let i = 1; i < MAX_ATTEMPTS; i++) total += backoffMs(i);
    expect(total).toBeGreaterThan(8 * 3_600_000);
  });

  it('vaqtinchalik xatolar qayta urinadi, imzo/format xatolari — yo\'q', () => {
    for (const s of [500, 502, 503, 404, 408, 429]) expect(retryable(s)).toBe(true);
    for (const s of [400, 401, 403, 422]) expect(retryable(s)).toBe(false);
  });
});
