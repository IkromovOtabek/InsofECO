import { kv, secure } from './storage';

/**
 * Tez kirish uchun PIN.
 *
 * PIN qurilmaning xavfsiz omborida (iOS Keychain / Android Keystore) saqlanadi —
 * tizimga kirish tokeni qayerda tursa, o'sha yerda. PIN serverga yuborilmaydi:
 * u faqat ilovani ochishda to'siq, hisobning paroli emas.
 *
 * Noto'g'ri urinishlar sanaladi: 5 martadan keyin PIN o'chiriladi va
 * foydalanuvchi parol bilan qaytadan kiradi.
 */
const KEY = 'security.pin';
const FAILS = 'security.pinFails';
export const PIN_LEN = 4;
export const MAX_FAILS = 5;

export const pinStore = {
  async has() {
    return !!(await secure.get(KEY));
  },
  async set(pin: string) {
    await secure.set(KEY, pin);
    kv.delete(FAILS);
  },
  async clear() {
    await secure.del(KEY);
    kv.delete(FAILS);
  },
  /** To'g'ri bo'lsa hisoblagich tozalanadi; 5 marta xato bo'lsa PIN o'chadi. */
  async verify(pin: string): Promise<{ ok: boolean; left: number; wiped?: boolean }> {
    const saved = await secure.get(KEY);
    if (!saved) return { ok: false, left: 0, wiped: true };
    if (saved === pin) {
      kv.delete(FAILS);
      return { ok: true, left: MAX_FAILS };
    }
    const fails = (kv.getNumber(FAILS) ?? 0) + 1;
    kv.set(FAILS, fails);
    if (fails >= MAX_FAILS) {
      await this.clear();
      return { ok: false, left: 0, wiped: true };
    }
    return { ok: false, left: MAX_FAILS - fails };
  },
};
