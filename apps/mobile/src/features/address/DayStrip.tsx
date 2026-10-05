import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
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
 * uzoqroq sana — kalendardan.
 *
 * Vaqt mintaqasi: kunlar va slotlar HAR DOIM Toshkent vaqtida (UTC+5, yozgi vaqt yo'q) — telefon
 * boshqa mintaqaga sozlangan bo'lsa ham (chet eldan buyurtma, noto'g'ri sozlama). Kun kaliti —
 * Toshkentdagi `YYYY-MM-DD`; ichki `Date` qiymatlari "devor soati" ko'rinishida (UTC maydonlari =
 * Toshkent sanasi), shuning uchun faqat `getUTC*` ishlatiladi. Serverga `isoAt()` — `+05:00` bilan.
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
/** Toshkent: UTC+5, yozgi vaqt yo'q (2011 yildan beri o'zgarmagan). */
export const TASHKENT_OFFSET_MIN = 5 * 60;
const OFFSET_MS = TASHKENT_OFFSET_MIN * 60_000;
const DAY_MS = 86_400_000;

/** Hozir Toshkentda — "devor soati" (UTC maydonlari = Toshkent sanasi va soati). */
export const tashkentNow = (now = Date.now()) => new Date(now + OFFSET_MS);
/** Toshkentdagi hozirgi soat (0–23) — slot "o'tib ketdimi" tekshiruvi uchun. */
export const tashkentHour = (now = Date.now()) => tashkentNow(now).getUTCHours();

/** Kun kaliti (`YYYY-MM-DD`) — devor soati sanasidan. `toISOString()` emas: u UTC kunini beradi. */
export const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
/** `YYYY-MM-DD` → shu kunning devor soati yarim tuni. */
export function parseYmd(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}
/** Toshkentdagi bugun (devor soati yarim tuni). */
export const startOfToday = () => { const t = tashkentNow(); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); };
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const daysFromToday = (key: string) => Math.round((parseYmd(key).getTime() - startOfToday().getTime()) / DAY_MS);
/** Kun + "HH:mm" (Toshkent vaqti) → haqiqiy vaqt nuqtasi (`getTime()` bilan solishtirish uchun). */
export const atTime = (key: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(parseYmd(key).getTime() + ((h ?? 0) * 60 + (m ?? 0)) * 60_000 - OFFSET_MS);
};
/** Serverga yuboriladigan vaqt: `2026-10-05T14:00:00+05:00` — mintaqa aniq, telefon sozlamasiga bog'liq emas. */
export const isoAt = (key: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${key}T${pad2(h ?? 0)}:${pad2(m ?? 0)}:00+05:00`;
};

/** Chipdagi yuqori yozuv: "Bugun", "Ertaga" yoki hafta kuni. */
export function dayWord(key: string) {
  const n = daysFromToday(key);
  return n === 0 ? 'Bugun' : n === 1 ? 'Ertaga' : WEEKDAY_SHORT[parseYmd(key).getUTCDay()]!;
}
/** "3-okt" */
export const shortDate = (key: string) => { const d = parseYmd(key); return `${d.getUTCDate()}-${MONTH_SHORT[d.getUTCMonth()]}`; };
/** Xulosa qatori: "Bugun, 3-oktabr" / "Yakshanba, 5-oktabr". */
export function dayLabelLong(key: string) {
  const d = parseYmd(key), n = daysFromToday(key);
  const word = n === 0 ? 'Bugun' : n === 1 ? 'Ertaga' : WEEKDAY_LONG[d.getUTCDay()];
  return `${word}, ${d.getUTCDate()}-${MONTH_LONG[d.getUTCMonth()]!.toLowerCase()}`;
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
          const sunday = parseYmd(key).getUTCDay() === 0;
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
      {/* `Sheet` — absolute qatlam: DayStrip ScrollView/Card ichida turadi, shuning uchun kalendar
          oyna darajasida (RN Modal) ochiladi, aks holda u kontent ichida qirqilib, ekran pastida emas,
          scroll kontentining oxirida chiqardi. */}
      <Modal visible={calendar} transparent animationType="none" statusBarTranslucent onRequestClose={() => setCalendar(false)}>
        <CalendarSheet
          open={calendar} value={value} maxDays={maxDays} isDisabled={isDisabled}
          onClose={() => setCalendar(false)}
          onPick={(k) => { setCalendar(false); pick(k); }}
        />
      </Modal>
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
  // Oy boshi — devor soati (UTC) sanasi: telefon mintaqasidan qat'i nazar Toshkent kalendari
  const monthOf = (y: number, m: number) => new Date(Date.UTC(y, m, 1));
  const [month, setMonth] = useState(monthOf(initial.getUTCFullYear(), initial.getUTCMonth()));
  useEffect(() => { if (open) { const v = value ? parseYmd(value) : startOfToday(); setMonth(monthOf(v.getUTCFullYear(), v.getUTCMonth())); } }, [open, value]);

  const first = month;
  const fy = first.getUTCFullYear(), fm = first.getUTCMonth();
  const lead = (first.getUTCDay() + 6) % 7; // dushanbadan boshlab nechta bo'sh katak
  const inMonth = new Date(Date.UTC(fy, fm + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: inMonth }, (_, i) => ymd(new Date(Date.UTC(fy, fm, i + 1))))];
  while (cells.length % 7) cells.push(null);
  const canPrev = first > monthOf(today.getUTCFullYear(), today.getUTCMonth());
  const canNext = monthOf(fy, fm + 1) <= last;
  const todayKey = ymd(today);

  return (
    <Sheet open={open} onClose={onClose} title="Kunni tanlang">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <IconButton icon="chevron-left" label="Oldingi oy" variant="secondary" disabled={!canPrev} onPress={() => setMonth(monthOf(fy, fm - 1))} />
        <Txt v="titleSm" accessibilityRole="header">{`${MONTH_LONG[fm]} ${fy}`}</Txt>
        <IconButton icon="chevron-right" label="Keyingi oy" variant="secondary" disabled={!canNext} onPress={() => setMonth(monthOf(fy, fm + 1))} />
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
                <Txt v={isToday || on ? 'bodyStrong' : 'body'} style={{ color: on ? c.textOnBrand : off ? c.textFaint : isToday ? c.brand : c.textStrong }}>{String(d.getUTCDate())}</Txt>
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
