import { assertNotPast } from './orders.service';

describe("buyurtma vaqti o'tmishda bo'lmasin", () => {
  const now = new Date('2026-10-05T10:00:00Z');
  it("kecha — rad", () => expect(() => assertNotPast(new Date('2026-10-04T10:00:00Z'), now)).toThrow("o'tib ketgan"));
  it('10 daqiqa oldin — zaxira ichida, o\'tadi', () => expect(() => assertNotPast(new Date('2026-10-05T09:50:00Z'), now)).not.toThrow());
  it('ertaga — o\'tadi', () => expect(() => assertNotPast(new Date('2026-10-06T03:00:00Z'), now)).not.toThrow());
});
