import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
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
