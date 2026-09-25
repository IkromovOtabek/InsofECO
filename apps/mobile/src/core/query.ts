import { AppState } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiException } from './api';

/**
 * React Query sozlamasi.
 *
 * Asosiy qoida: ekranni qo'l bilan tortib yangilash SHART EMAS. Ma'lumot o'zi kelib turadi —
 * ilova ochiq turganda davriy, ilovaga qaytilganda esa darhol. Sababi oddiy: dispetcher
 * ham, haydovchi ham ekranga qarab turadi va "bu raqam eskimi?" degan savol bo'lmasligi kerak.
 */

/**
 * React Native'da `window` yo'q, shuning uchun React Query o'zi "ekranga qaytildi" ni
 * bilmaydi va `refetchOnWindowFocus` hech narsa qilmaydi. AppState'ni ulab qo'yamiz:
 * ilova fonga ketib qaytganda barcha ochiq so'rovlar yangilanadi.
 *
 * Yon foydasi: fonga ketganda `refetchInterval` ham to'xtaydi (React Query "focus"
 * bo'lmaganda davriy so'rov yubormaydi) — batareya bekorga sarflanmaydi.
 */
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
  return () => sub.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 3600_000, // offline persist uchun
      /**
       * Ilova ochiq turganda har yarim daqiqada yangilanadi. Bu — SUKUT qiymati:
       * tez-tez o'zgaradigan ekranlar (suhbat, dispetcher taxtasi, reys) o'z
       * qiymatini beradi va u shu yerdagini bosib o'tadi.
       */
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      /** Ekran qayta ochilganda eski ma'lumot ko'rsatilib, orqada yangilanadi. */
      refetchOnMount: true,
      retry: (count, err) => !(err instanceof ApiException && err.status < 500) && count < 2,
    },
    mutations: { retry: 0 },
  },
});

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'rq.v1' });
