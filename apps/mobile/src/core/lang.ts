import { create } from 'zustand';
import { kv } from '@/core/storage';
import { makeTranslator, type RuDict } from '@/core/ru-translate';

/**
 * Ilova tili: o'zbekcha (asl matn) yoki ruscha. Tanlov MMKV'da sinxron saqlanadi — ilova qayta ochilganda
 * birinchi kadrdanoq shu tilda. Ruscha — lug'at bo'yicha (`./ru-translate.ts`): `Txt`, `Input`, `Button`
 * matni chizilayotganda o'giriladi, serverdan kelgan matn ham (alohida server tarjimasi shart emas).
 */
export type Lang = 'uz' | 'ru';

const K = 'ui.lang';
const read = (): Lang => (kv.getString(K) === 'ru' ? 'ru' : 'uz');

let tr: ((s: string) => string) | null = null;
/** Lug'at birinchi kerak bo'lganda yig'iladi (≈1 MB JSON — o'zbekcha tanlaganlar uchun ishga tushmaydi). */
function translator() {
  if (!tr) tr = makeTranslator(require('./ru.json') as RuDict);
  return tr;
}

interface LangState { lang: Lang; setLang: (l: Lang) => void }
export const useLang = create<LangState>((set) => ({
  lang: read(),
  setLang: (lang) => { kv.set(K, lang); set({ lang }); },
}));

/** Joriy til (hook'siz — so'rov sarlavhasi va hook bo'lmagan joylar uchun). */
export const currentLang = (): Lang => useLang.getState().lang;

/** Matnni joriy tilga o'giradi; o'zbekchada — o'zi. */
export const t = (s: string): string => (useLang.getState().lang === 'ru' ? translator()(s) : s);

/** React bolalari: satrlar o'giriladi, qolgani (element, son) o'zgarmaydi. */
export function tChildren(ch: React.ReactNode): React.ReactNode {
  if (typeof ch === 'string') return t(ch);
  if (Array.isArray(ch)) return ch.map((x) => (typeof x === 'string' ? t(x) : x));
  return ch;
}
