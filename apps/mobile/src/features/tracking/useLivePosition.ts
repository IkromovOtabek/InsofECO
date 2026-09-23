import { useEffect, useState } from 'react';
import { getSocket } from '@/core/socket';

export interface LivePosition { deliveryId: string; lat: number; lng: number; speedKmh?: number; heading?: number; at: string; etaMin: number | null }

/** Quruvchi/Tadbirkor: reysni jonli kuzatish (WS room). */
export function useLivePosition(deliveryId: string | null) {
  const [pos, setPos] = useState<LivePosition | null>(null);
  useEffect(() => {
    if (!deliveryId) return;
    let active = true;
    let cleanup = () => {};
    void getSocket().then((s) => {
      if (!active) return;
      const handler = (p: LivePosition) => { if (p.deliveryId === deliveryId) setPos(p); };
      s.on('position', handler);
      s.emit('watch', { deliveryId });
      cleanup = () => { s.off('position', handler); s.emit('unwatch', { deliveryId }); };
    });
    return () => { active = false; cleanup(); };
  }, [deliveryId]);
  return pos;
}
