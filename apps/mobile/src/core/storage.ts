import { MMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';

/** Tez, sinxron kesh (offline navbat, TanStack persist). Tokenlar bu yerda emas. */
export const kv = new MMKV({ id: 'insof' });

export const secure = {
  get: (k: string) => SecureStore.getItemAsync(k),
  set: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  del: (k: string) => SecureStore.deleteItemAsync(k),
};

export const KEYS = {
  access: 'auth.access', refresh: 'auth.refresh', deviceId: 'device.id',
  // Insof ERP xodim sessiyasi — ECO tokenlaridan alohida
  erpAccess: 'erp.access', erpRefresh: 'erp.refresh',
} as const;
