import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { IconButton, Txt } from '@/design/primitives';
import { Icon, Sheet } from '@/design/ui';
import { PressScale, haptic } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';

/**
 * Buyurtma kuni: gorizontal kun lentasi (~2 hafta) + "Kalendar" — oy jadvali.
 *
 * Nega: "Bugun / Ertaga / Indinga" — qaysi sana ekani ko'rinmaydi, "indinga" so'zi esa
 * ko'pchilikka notanish. Har chipda haqiqiy sana bor ("Bugun · 3-okt", "Yak · 5-okt"),
 * uzoqroq sana — kalendardan. Kun kaliti — mahalliy `YYYY-MM-DD` (vaqt mintaqasi siljimaydi:
 * server bilan almashishda kun + soatdan mahalliy `Date` yasalib, ISO (UTC) yuboriladi).
 *
 * Joylashuvi: src/features/address — buyurtma formalarining umumiy qismi (manzil + kun).
 */

export const WEEKDAY_SHORT = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
const WEEKDAY_LONG = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
export const MONTH_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const MONTH_LONG = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
/** Kalendar haftasi dushanbadan boshlanadi (O'zbekistonda shunday). */
const GRID_HEAD = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

const pad2 = (n: number) => String(n).padStart(2, '0');
/** Mahalliy kun kaliti. `toISOString()` ishlatilmaydi — u UTC, Toshkentda 00:00-05:00 da kechagi kunni beradi. */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
/** `YYYY-MM-DD` → mahalliy yarim tun. */
export function parseYmd(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}
export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysFromToday = (key: string) => Math.round((parseYmd(key).getTime() - startOfToday().getTime()) / 86_400_000);
/** Kun + "HH:mm" → mahalliy vaqt (`toISOString()` bilan yuboriladi). */
export const atTime = (key: string, hhmm: string) => { const d = parseYmd(key); const [h, m] = hhmm.split(':').map(Number); d.setHours(h ?? 0, m ?? 0, 0, 0); return d; };

/** Chipdagi yuqori yozuv: "Bugun", "Ertaga" yoki hafta kuni. */
export function dayWord(key: string) {
  const n = daysFromToday(key);
  return n === 0 ? 'Bugun' : n === 1 ? 'Ertaga' : WEEKDAY_SHORT[parseYmd(key).getDay()]!;
}
/** "3-okt" */
export const shortDate = (key: string) => { const d = parseYmd(key); return `${d.getDate()}-${MONTH_SHORT[d.getMonth()]}`; };
/** Xulosa qatori: "Bugun, 3-oktabr" / "Yakshanba, 5-oktabr". */
export function dayLabelLong(key: string) {
  const d = parseYmd(key), n = daysFromToday(key);
  const word = n === 0 ? 'Bugun' : n === 1 ? 'Ertaga' : WEEKDAY_LONG[d.getDay()];
  return `${word}, ${d.getDate()}-${MONTH_LONG[d.getMonth()]!.toLowerCase()}`;
}

export function DayStrip({ value, onChange, days = 14, maxDays = 90, isDisabled }: {
  /** Tanlangan kun (`YYYY-MM-DD`) yoki bo'sh. */
  value: string;
  onChange: (key: string) => void;
  /** Lentada nechta kun (bugundan boshlab). */
  days?: number;
  /** Kalendarda bugundan necha kun oldinga tanlash mumkin. */
  maxDays?: number;
  /** Masalan, bugungi bo'sh vaqt qolmagan bo'lsa — bugun yopiq. */
  isDisabled?: (key: string) => boolean;
}) {
  const { c } = useTheme();
  const [calendar, setCalendar] = useState(false);
  const scroll = useRef<ScrollView | null>(null);
  const xs = useRef<Record<string, number>>({});
  const strip = useMemo(() => { const t = startOfToday(); return Array.from({ length: days }, (_, i) => ymd(addDays(t, i))); }, [days]);
  const inStrip = strip.includes(value);

  // Tanlangan kun ko'rinib tursin (kalendardan tanlanganda yoki ekranga qaytilganda)
  useEffect(() => {
    const x = xs.current[value];
    if (x != null) scroll.current?.scrollTo({ x: Math.max(0, x - space.xxl), animated: true });
  }, [value]);

  const pick = (key: string) => { haptic.selection(); onChange(key); };

  return (
    <>
      <ScrollView
        ref={scroll} horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs, paddingRight: space.lg }}
        accessibilityRole="radiogroup" accessibilityLabel="Kun"
      >
        {strip.map((key) => {
          const on = key === value;
          const off = !!isDisabled?.(key);
          const sunday = parseYmd(key).getDay() === 0;
          return (
            <PressScale
              key={key} haptic={false} disabled={off} onPress={() => pick(key)}
              onLayout={(e) => { xs.current[key] = e.nativeEvent.layout.x; }}
              accessibilityRole="radio" accessibilityState={{ selected: on, disabled: off }}
              accessibilityLabel={`${dayLabelLong(key)}${off ? ', band' : ''}`}
              style={{
                minWidth: size.avatarLg + space.lg, paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, borderCurve: 'continuous',
                alignItems: 'center', backgroundColor: on ? c.brand : off ? c.bgMuted : c.bgSurface, borderWidth: size.hairline, borderColor: on ? c.brand : c.borderSubtle,
              }}
            >
              <Txt v="caption" numberOfLines={1} style={{ color: on ? c.textOnBrand : off ? c.textFaint : sunday ? c.danger : c.textMuted }}>{dayWord(key)}</Txt>
              <Txt v="bodyStrong" numberOfLines={1} style={{ color: on ? c.textOnBrand : off ? c.textFaint : c.textStrong, textDecorationLine: off ? 'line-through' : 'none' }}>{shortDate(key)}</Txt>
            </PressScale>
          );
        })}
        {/* Lentadan tashqari sana — kalendardan; tanlangan bo'lsa shu chipda ko'rinadi */}
        <PressScale
          haptic={false} onPress={() => { haptic.selection(); setCalendar(true); }}
          accessibilityRole="button" accessibilityLabel={!inStrip && value ? `Kalendar, tanlangan: ${dayLabelLong(value)}` : 'Kalendarni ochish'}
          style={{
            minWidth: size.avatarLg + space.lg, paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, borderCurve: 'continuous',
            alignItems: 'center', justifyContent: 'center', gap: space.xs, flexDirection: 'row',
            backgroundColor: !inStrip && value ? c.brand : c.brandSoft, borderWidth: size.hairline, borderColor: c.brand,
          }}
        >
          <Icon name="calendar-days" size={size.iconMd} color={!inStrip && value ? c.textOnBrand : c.brand} />
          <Txt v="bodyStrong" style={{ color: !inStrip && value ? c.textOnBrand : c.brand }}>{!inStrip && value ? shortDate(value) : 'Kalendar'}</Txt>
        </PressScale>
      </ScrollView>
      <CalendarSheet
        open={calendar} value={value} maxDays={maxDays} isDisabled={isDisabled}
        onClose={() => setCalendar(false)}
        onPick={(k) => { setCalendar(false); pick(k); }}
      />
    </>
  );
}

/** Oy jadvali: o'tgan kunlar va chegaradan keyingilar yopiq, bugun — halqa, tanlangan — to'liq rang. */
export function CalendarSheet({ open, value, onPick, onClose, maxDays = 90, isDisabled }: {
  open: boolean; value: string; onPick: (key: string) => void; onClose: () => void; maxDays?: number; isDisabled?: (key: string) => boolean;
}) {
  const { c } = useTheme();
  const today = startOfToday();
  const last = addDays(today, maxDays);
  const initial = value ? parseYmd(value) : today;
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  useEffect(() => { if (open) { const v = value ? parseYmd(value) : startOfToday(); setMonth(new Date(v.getFullYear(), v.getMonth(), 1)); } }, [open, value]);

  const first = month;
  const lead = (first.getDay() + 6) % 7; // dushanbadan boshlab nechta bo'sh katak
  const inMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: inMonth }, (_, i) => ymd(new Date(first.getFullYear(), first.getMonth(), i + 1)))];
  while (cells.length % 7) cells.push(null);
  const canPrev = first > new Date(today.getFullYear(), today.getMonth(), 1);
  const canNext = new Date(first.getFullYear(), first.getMonth() + 1, 1) <= last;
  const todayKey = ymd(today);

  return (
    <Sheet open={open} onClose={onClose} title="Kunni tanlang">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <IconButton icon="chevron-left" label="Oldingi oy" variant="secondary" disabled={!canPrev} onPress={() => setMonth(new Date(first.getFullYear(), first.getMonth() - 1, 1))} />
        <Txt v="titleSm" accessibilityRole="header">{`${MONTH_LONG[first.getMonth()]} ${first.getFullYear()}`}</Txt>
        <IconButton icon="chevron-right" label="Keyingi oy" variant="secondary" disabled={!canNext} onPress={() => setMonth(new Date(first.getFullYear(), first.getMonth() + 1, 1))} />
      </View>
      <View style={{ flexDirection: 'row', marginBottom: space.xs }}>
        {GRID_HEAD.map((w, i) => <Txt key={w} v="caption" align="center" style={{ flex: 1, color: i === 6 ? c.danger : c.textMuted }}>{w}</Txt>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }} accessibilityRole="radiogroup">
        {cells.map((key, i) => {
          if (!key) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: size.touch }} />;
          const d = parseYmd(key);
          const off = d < today || d > last || !!isDisabled?.(key);
          const on = key === value;
          const isToday = key === todayKey;
          return (
            <View key={key} style={{ width: `${100 / 7}%`, height: size.touch + space.xs, alignItems: 'center', justifyContent: 'center' }}>
              <PressScale
                haptic={false} disabled={off} onPress={() => onPick(key)}
                accessibilityRole="radio" accessibilityState={{ selected: on, disabled: off }}
                accessibilityLabel={`${dayLabelLong(key)}${isToday ? ', bugun' : ''}${off ? ', tanlab bo\'lmaydi' : ''}`}
                style={{
                  width: size.touch, height: size.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? c.brand : 'transparent', borderWidth: isToday && !on ? size.ring : 0, borderColor: c.brand,
                }}
              >
                <Txt v={isToday || on ? 'bodyStrong' : 'body'} style={{ color: on ? c.textOnBrand : off ? c.textFaint : isToday ? c.brand : c.textStrong }}>{String(d.getDate())}</Txt>
              </PressScale>
            </View>
          );
        })}
      </View>
      <Txt v="caption" color="muted" align="center" style={{ marginTop: space.md }}>
        {`O'tgan kunlar yopiq · ${maxDays} kungacha oldindan tanlash mumkin`}
      </Txt>
    </Sheet>
  );
}
