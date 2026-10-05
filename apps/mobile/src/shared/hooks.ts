import { useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { onOutboxChange, outbox } from '@/core/outbox';

/** Outbox hajmi — "kutilayotgan o'zgarishlar" indikatori uchun. */
export function useOutboxSize() {
  const [n, setN] = useState(outbox.size());
  useEffect(() => { const off = onOutboxChange(() => setN(outbox.size())); return () => { off(); }; }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void outbox.flush(); });
    return () => sub.remove();
  }, []);
  return n;
}

/**
 * Davriy so'rov oralig'i — faqat ekran ko'rinib turganda.
 *
 * React Query fonga ketganda (AppState) to'xtaydi, lekin stekda OSTDA qolgan ekranni bilmaydi:
 * suhbat ochilgan paytda ostidagi dashboard, xabarlar va reys ro'yxati ham har 15–30 s da
 * so'rov yuborib turardi. Ekran yopilganda (blur) `false`, qaytganda qiymat tiklanadi.
 * Navigator tashqarisida (kontekst yo'q) — o'zgarishsiz.
 */
export function usePollInterval<T extends number | false | undefined>(ms: T): T | false {
  const nav = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => nav?.isFocused() ?? true);
  useEffect(() => {
    if (!nav) return;
    const sync = () => setFocused(nav.isFocused());
    sync();
    const offs = [nav.addListener('focus', sync), nav.addListener('blur', sync), nav.addListener('state', sync)];
    return () => offs.forEach((off) => off());
  }, [nav]);
  return focused ? ms : false;
}
