import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, IconButton, Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { Appear, haptic } from '@/design/motion';
import { radius, shadow, size, space } from '@/design/tokens';

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const WEEK = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const QUICK: [number, string][] = [[7, '7 kun'], [30, '30 kun'], [90, '90 kun']];

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : null);
const short = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3).toLowerCase()}`;

const CELL_H = size.touch - space.xs;
const DOT = size.touch - space.sm;

/**
 * Oraliq tanlash kalendari — ekran ichida ochiladi (modal emas: iOS'da native oyna
 * ko'rinmay qolish holati bor edi). Birinchi bosish — boshlanish, ikkinchisi — tugash;
 * kelajak kunlari tanlanmaydi (tushum hali yo'q).
 * Yumshoq karta: oraliq — brend-soft tasma, chetlari — brend doira, bugun — halqa.
 */
export function RangeCalendar({ from, to, onApply, onClose }: { from?: string | null; to?: string | null; onApply: (from: string, to: string) => void; onClose: () => void }) {
  const { c } = useTheme();
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [a, setA] = useState<Date | null>(parse(from));
  const [b, setB] = useState<Date | null>(parse(to));
  const [view, setView] = useState(() => { const d = parse(to) ?? today; return new Date(d.getFullYear(), d.getMonth(), 1); });

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // dushanbadan
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    return [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))];
  }, [view]);

  const pick = (d: Date) => {
    haptic.selection();
    if (!a || b) { setA(d); setB(null); return; }
    if (d < a) { setB(a); setA(d); } else setB(d);
  };
  const shift = (n: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));
  const nextDisabled = view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth();
  const inRange = (d: Date) => !!a && !!b && d >= a && d <= b;
  const isEdge = (d: Date) => (!!a && d.getTime() === a.getTime()) || (!!b && d.getTime() === b.getTime());
  const cellW = `${100 / 7}%` as const;

  const quick = (days: number) => { haptic.selection(); const s = new Date(today); s.setDate(s.getDate() - (days - 1)); setA(s); setB(today); setView(new Date(today.getFullYear(), today.getMonth(), 1)); };
  /** Qaysi tezkor oraliq hozir tanlangan (bo'lsa). */
  const quickOn = (days: number) => {
    if (!a || !b || b.getTime() !== today.getTime()) return false;
    const s = new Date(today); s.setDate(s.getDate() - (days - 1));
    return a.getTime() === s.getTime();
  };
  const span = a && b ? Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1 : a ? 1 : 0;

  return (
    <Appear from={-8} scale={0.99}>
      <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: space.md }, shadow.pop]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <IconButton icon="chevron-left" label="Oldingi oy" variant="secondary" size={size.touch - space.xs} onPress={() => shift(-1)} />
          <Txt v="titleSm" align="center" style={{ flex: 1 }}>{MONTHS[view.getMonth()]} {view.getFullYear()}</Txt>
          <IconButton icon="chevron-right" label="Keyingi oy" variant="secondary" size={size.touch - space.xs} onPress={() => shift(1)} disabled={nextDisabled} style={nextDisabled ? { opacity: 0.4 } : undefined} />
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {QUICK.map(([n, l]) => {
            const on = quickOn(n);
            return (
              <Pressable key={l} onPress={() => quick(n)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Oxirgi ${l}`}
                style={({ pressed }) => [{ flex: 1, minHeight: size.touch - space.sm, borderRadius: radius.pill, backgroundColor: on ? c.brand : c.bgMuted, alignItems: 'center', justifyContent: 'center' }, pressed && !on && { backgroundColor: c.bgSubtle }]}>
                <Txt v="label" color={on ? 'onBrand' : 'body'}>{l}</Txt>
              </Pressable>
            );
          })}
        </View>

        <View>
          <View style={{ flexDirection: 'row', marginBottom: space.xs }}>
            {WEEK.map((w, i) => <Txt key={w} v="overline" color={i >= 5 ? 'faint' : 'muted'} align="center" style={{ width: cellW }}>{w}</Txt>)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 2 }}>
            {cells.map((d, i) => {
              if (!d) return <View key={`e${i}`} style={{ width: cellW, height: CELL_H }} />;
              const future = d > today;
              const edge = isEdge(d), mid = inRange(d) && !edge;
              const isToday = d.getTime() === today.getTime();
              const ranged = !!a && !!b && a.getTime() !== b.getTime();
              // Tasma chetdagi doiradan yarmigacha cho'ziladi — oraliq uzluksiz ko'rinadi
              const bandLeft = ranged && edge && b && d.getTime() === b.getTime();
              const bandRight = ranged && edge && a && d.getTime() === a.getTime();
              return (
                <Pressable key={ymd(d)} disabled={future} onPress={() => pick(d)} accessibilityRole="button" accessibilityLabel={ymd(d)} accessibilityState={{ selected: edge || mid, disabled: future }}
                  style={{ width: cellW, height: CELL_H, alignItems: 'center', justifyContent: 'center' }}>
                  {mid ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: (CELL_H - DOT) / 2, height: DOT, backgroundColor: c.brandSoft }} /> : null}
                  {bandLeft ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: '50%', top: (CELL_H - DOT) / 2, height: DOT, backgroundColor: c.brandSoft }} /> : null}
                  {bandRight ? <View pointerEvents="none" style={{ position: 'absolute', left: '50%', right: 0, top: (CELL_H - DOT) / 2, height: DOT, backgroundColor: c.brandSoft }} /> : null}
                  <View style={{ width: DOT, height: DOT, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: edge ? c.brand : undefined, borderWidth: isToday && !edge ? size.ring : 0, borderColor: c.brandRing }}>
                    <Txt v={edge || isToday ? 'bodyStrong' : 'body'} style={{ color: edge ? c.textOnBrand : future ? c.textFaint : mid ? c.brandInk : c.textBody }}>{d.getDate()}</Txt>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.touch - space.sm, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: c.bgSubtle }} accessibilityLiveRegion="polite">
          <Icon name="calendar-days" tone={a ? 'brand' : 'faint'} size={size.iconSm} />
          <Txt v="label" color={a ? 'strong' : 'muted'} style={{ flex: 1 }} numberOfLines={1}>
            {a ? `${short(a)}${b ? ` — ${short(b)}` : ' — tugash kunini tanlang'}` : 'Boshlanish kunini tanlang'}
          </Txt>
          {span > 1 ? <Txt v="caption" color="brand">{span} kun</Txt> : null}
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><Button title="Bekor" variant="secondary" onPress={onClose} /></View>
          <View style={{ flex: 1 }}><Button title="Qo'llash" icon="check" disabled={!a} onPress={() => a && onApply(ymd(a), ymd(b ?? a))} /></View>
        </View>
      </View>
    </Appear>
  );
}
