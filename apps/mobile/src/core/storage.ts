import { MMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';

/** Tez, sinxron kesh (offline navbat, TanStack persist). Tokenlar bu yerda emas. */
export const kv = new MMKV({ id: 'insof' });

/**
 * iOS Keychain: yozuv telefon birinchi marta ochilgandan keyin qulflangan holda ham o'qiladi —
 * fon GPS vazifasi tokenni ekran qulfida o'qiydi (standart `WHEN_UNLOCKED` da `null` qaytar va nuqtalar yo'qolardi).
 */
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

export const secure = {
  get: (k: string) => SecureStore.getItemAsync(k, OPTS),
  set: (k: string, v: string) => SecureStore.setItemAsync(k, v, OPTS),
  del: (k: string) => SecureStore.deleteItemAsync(k, OPTS),
};

export const KEYS = {
  access: 'auth.access', refresh: 'auth.refresh', deviceId: 'device.id',
  // Insof ERP xodim sessiyasi — ECO tokenlaridan alohida
  erpAccess: 'erp.access', erpRefresh: 'erp.refresh',
} as const;

/** Ikkala hisobning tokenlarini o'chirish — chiqishda va PIN 5 marta xato bo'lganda (hech qanday tarmoq so'rovidan OLDIN). */
export const wipeAuthTokens = () => Promise.all([secure.del(KEYS.access), secure.del(KEYS.refresh), secure.del(KEYS.erpAccess), secure.del(KEYS.erpRefresh)]).then(() => undefined);
