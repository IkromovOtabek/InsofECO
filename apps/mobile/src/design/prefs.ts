import { create } from 'zustand';
import { kv } from '@/core/storage';
import { PaletteName, palettes } from './tokens';

/** Ko'rinish rejimi: tizimga ergashadi yoki foydalanuvchi qo'lda tanlaydi. */
export type SchemePref = 'system' | 'light' | 'dark';

interface Prefs {
  scheme: SchemePref;
  palette: PaletteName;
  setScheme: (s: SchemePref) => void;
  setPalette: (p: PaletteName) => void;
}

const K = { scheme: 'ui.scheme', palette: 'ui.palette' } as const;

const readScheme = (): SchemePref => {
  const v = kv.getString(K.scheme);
  return v === 'light' || v === 'dark' ? v : 'system';
};
const readPalette = (): PaletteName => {
  const v = kv.getString(K.palette);
  return v && v in palettes ? (v as PaletteName) : 'chizma';
};

/**
 * Ko'rinish sozlamalari (Sozlamalar → Mavzu). MMKV'da sinxron saqlanadi — ilova qayta ochilganda
 * birinchi kadrdanoq to'g'ri rang chiqadi, "sakrash" bo'lmaydi.
 */
export const usePrefs = create<Prefs>((set) => ({
  scheme: readScheme(),
  palette: readPalette(),
  setScheme: (scheme) => { kv.set(K.scheme, scheme); set({ scheme }); },
  setPalette: (palette) => { kv.set(K.palette, palette); set({ palette }); },
}));
