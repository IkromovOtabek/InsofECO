import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { create } from 'zustand';
import { config } from './config';

/**
 * Majburiy yangilanish (HTTP 426 / `code: APP_UPDATE_REQUIRED`).
 *
 * Har bir so'rov (ECO, ERP, do'kon) ilova versiyasi va platformasini sarlavhada yuboradi — server
 * eski ilovani taniydi va 426 qaytaradi. Javob kelganda global holat yoqiladi, ildiz maketi
 * butun ekranli "Ilovani yangilang" sahifasini chizadi (`components/update-required.tsx`).
 */

/** `app.config.ts` → `version` (masalan `1.0.2`). OTA update bu raqamni o'zgartirmaydi — native build versiyasi. */
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
export const APP_PLATFORM = Platform.OS;

/** Har so'rovga qo'shiladigan sarlavhalar (fetch kichik harfga keltiradi — server ikkalasini ham o'qiydi). */
export const appHeaders = (): Record<string, string> => ({ 'x-app-version': APP_VERSION, 'x-app-platform': APP_PLATFORM });

export interface UpdateInfo {
  message: string;
  /** Do'kon/APK havolasi — javobdan, bo'lmasa `config.storeUrl`. */
  url: string | null;
}

interface UpdateState {
  required: UpdateInfo | null;
  set: (info: UpdateInfo) => void;
}

export const useAppUpdate = create<UpdateState>((set) => ({
  required: null,
  set: (info) => set({ required: info }),
}));

const DEFAULT_MESSAGE = "Ilovaning bu versiyasi endi qo'llab-quvvatlanmaydi. Davom etish uchun yangi versiyani o'rnating.";

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const httpUrl = (v: unknown) => { const s = str(v); return s && /^https?:\/\//i.test(s) ? s : null; };

/**
 * Javob majburiy yangilanishmi — bo'lsa global ekran yoqiladi va `true`. Chaqiruvchi baribir
 * xato tashlaydi (so'rov bajarilmadi); ekran esa hamma narsaning ustida turadi.
 * Havola maydonlari: `updateUrl` / `storeUrl` / `url` (ildizda yoki `details` ichida).
 */
export function checkUpdateRequired(status: number, body: unknown): boolean {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (status !== 426 && b.code !== 'APP_UPDATE_REQUIRED') return false;
  const d = (b.details && typeof b.details === 'object' ? b.details : {}) as Record<string, unknown>;
  const url = httpUrl(b.updateUrl) ?? httpUrl(b.storeUrl) ?? httpUrl(b.url) ?? httpUrl(d.updateUrl) ?? httpUrl(d.storeUrl) ?? httpUrl(d.url) ?? config.storeUrl;
  useAppUpdate.getState().set({ message: str(b.message) ?? DEFAULT_MESSAGE, url });
  return true;
}
