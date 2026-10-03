import { useEffect, useState } from 'react';
import type { ShopSeller } from './api';

/**
 * "Bugungi holat" — zavod hozir ochiqmi va buyurtma bugun yetkaziladimi.
 * Katalog 24 soat keshlanadi, shuning uchun holatni server emas, ilova o'zi hisoblaydi:
 * soatlar ERP Sozlamalardan keladi, vaqt esa Toshkent (UTC+5, yozgi vaqt yo'q) —
 * telefonning mintaqasi boshqa bo'lsa ham zavod vaqti bo'yicha.
 */
const TZ_OFFSET_MS = 5 * 3600_000;
const WEEKDAY = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

export interface TodayStatus {
  open: boolean;
  /** "18:00 gacha" (ochiq bo'lsa) / "Ertaga 08:00 da ochiladi" */
  openLabel: string;
  sameDay: boolean;
  /** "Bugun 14:00 gacha buyurtma bering — bugun yetkazamiz" */
  deliveryLabel: string;
  /** Ish soatlari: "07:00–20:00" (demo "Zavod ochiq · 07:00–20:00"). */
  hoursLabel: string;
  /** Qisqa yetkazish: "Bugun yetkazamiz · 14:00 gacha buyurtma" / "Ertaga yetkazamiz". */
  deliveryShort: string;
}

export function todayStatus(h: NonNullable<ShopSeller['hours']>, now = new Date()): TodayStatus {
  const t = new Date(now.getTime() + TZ_OFFSET_MS);
  const day = t.getUTCDay();
  const hour = t.getUTCHours() + t.getUTCMinutes() / 60;
  const works = (d: number) => d !== 0 || h.sunday;

  const open = works(day) && hour >= h.open && hour < h.close;
  const sameDay = works(day) && hour < h.sameDayCutoff;

  // Keyingi ish kuni: ertaga yoki (yakshanba dam bo'lsa) dushanba
  let next = (day + 1) % 7;
  while (!works(next)) next = (next + 1) % 7;
  const nextName = next === (day + 1) % 7 ? 'ertaga' : (WEEKDAY[next] ?? 'ertaga');
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const openLabel = open
    ? `${hh(h.close)} gacha`
    : works(day) && hour < h.open
      ? `Bugun ${hh(h.open)} da ochiladi`
      : `${cap(nextName)} ${hh(h.open)} da ochiladi`;

  const deliveryLabel = sameDay
    ? `Bugun ${hh(h.sameDayCutoff)} gacha buyurtma bering — bugun yetkazamiz`
    : `Hozir buyurtma bering — ${nextName} yetkazamiz`;

  const hoursLabel = `${hh(h.open)}–${hh(h.close)}`;
  const deliveryShort = sameDay ? `Bugun yetkazamiz · ${hh(h.sameDayCutoff)} gacha buyurtma` : `${cap(nextName)} yetkazamiz`;

  return { open, openLabel, sameDay, deliveryLabel, hoursLabel, deliveryShort };
}

/** Holat daqiqada bir yangilanadi — sahifa ochiq turganda soat 14:00 dan o'tsa ham to'g'ri. */
export function useTodayStatus(hours: ShopSeller['hours'] | undefined) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  // Eski ERP javobi (`hours: {}` yoki yo'q) — belgi ko'rinmaydi, faqat aloqa tugmalari
  return hours && typeof hours.open === 'number' && typeof hours.close === 'number' ? todayStatus(hours, now) : null;
}
