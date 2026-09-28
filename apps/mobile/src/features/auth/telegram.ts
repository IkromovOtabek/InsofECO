import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { authApi } from '@/features/auth/api';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';

const EVERY_MS = 2000;

/**
 * Telegram orqali kirish: bot havolasini ochadi va foydalanuvchi botda raqamini ulashguncha
 * serverdan so'rab turadi. Ilovaga qaytilganda (AppState → active) kutmasdan darhol so'raydi.
 * Tasdiq kelganda oddiy `signIn` — keyingi yo'naltirishni Gate qiladi (rol tanlash va h.k.).
 */
export function useTelegramLogin() {
  const signIn = useSession((s) => s.signIn);
  const [nonce, setNonce] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();
  const busy = useRef(false);

  const cancel = useCallback(() => setNonce(null), []);

  const start = useCallback(async () => {
    setError(undefined);
    setStarting(true);
    try {
      const r = await authApi.telegramStart();
      setNonce(r.nonce);
      await Linking.openURL(r.url);
    } catch (e) {
      setNonce(null);
      setError(e instanceof ApiException ? e.message : 'Telegram ochilmadi. Internetni tekshiring');
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    if (!nonce) return;
    let alive = true;
    const poll = async () => {
      if (busy.current || !alive) return;
      busy.current = true;
      try {
        const r = await authApi.telegramPoll(nonce);
        if (alive && r.status === 'ok') {
          alive = false;
          setNonce(null);
          await signIn({ accessToken: r.accessToken, refreshToken: r.refreshToken }, r.user);
        }
      } catch (e) {
        // Muddat tugadi yoki server rad etdi — kutishni to'xtatamiz; tarmoq uzilishi esa keyingi urinishda o'tadi
        if (alive && e instanceof ApiException) { alive = false; setNonce(null); setError(e.message); }
      } finally {
        busy.current = false;
      }
    };
    const t = setInterval(poll, EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void poll(); });
    return () => { alive = false; clearInterval(t); sub.remove(); };
  }, [nonce, signIn]);

  return { start, cancel, waiting: !!nonce, starting, error };
}
