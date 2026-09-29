import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, IconButton, Txt } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space } from '@/design/tokens';

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const WEEK = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : null);

/**
 * Oraliq tanlash kalendari — ekran ichida ochiladi (modal emas: iOS'da native oyna
 * ko'rinmay qolish holati bor edi). Birinchi bosish — boshlanish, ikkinchisi — tugash;
 * kelajak kunlari tanlanmaydi (tushum hali yo'q).
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
    if (!a || b) { setA(d); setB(null); return; }
    if (d < a) { setB(a); setA(d); } else setB(d);
  };
  const shift = (n: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));
  const nextDisabled = view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth();
  const inRange = (d: Date) => !!a && !!b && d >= a && d <= b;
  const isEdge = (d: Date) => (!!a && d.getTime() === a.getTime()) || (!!b && d.getTime() === b.getTime());
  const cellW = `${100 / 7}%` as const;

  const quick = (days: number) => { const s = new Date(today); s.setDate(s.getDate() - (days - 1)); setA(s); setB(today); setView(new Date(today.getFullYear(), today.getMonth(), 1)); };

  return (
    <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderWidth: size.hairline, borderColor: c.borderDefault, padding: space.md, gap: space.sm }, shadow.card]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton icon="chevron-left" label="Oldingi oy" onPress={() => shift(-1)} />
        <Txt v="titleSm" align="center" style={{ flex: 1 }}>{MONTHS[view.getMonth()]} {view.getFullYear()}</Txt>
        <IconButton icon="chevron-right" label="Keyingi oy" onPress={() => shift(1)} disabled={nextDisabled} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEK.map((w) => <Txt key={w} v="caption" align="center" style={{ width: cellW }}>{w}</Txt>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={{ width: cellW, height: size.touch - space.xs }} />;
          const future = d > today;
          const edge = isEdge(d), mid = inRange(d) && !edge;
          return (
            <Pressable key={ymd(d)} disabled={future} onPress={() => pick(d)} accessibilityRole="button" accessibilityLabel={ymd(d)} accessibilityState={{ selected: edge || mid, disabled: future }}
              style={{ width: cellW, height: size.touch - space.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: mid ? c.brandSoft : undefined }}>
              <View style={{ width: size.touch - space.sm, height: size.touch - space.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: edge ? c.brand : undefined, borderWidth: d.getTime() === today.getTime() && !edge ? size.hairline : 0, borderColor: c.brand }}>
                <Txt v={edge ? 'bodyStrong' : 'body'} style={{ color: edge ? c.textOnBrand : future ? c.textFaint : c.textBody }}>{d.getDate()}</Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {[[7, '7 kun'], [30, '30 kun'], [90, '90 kun']].map(([n, l]) => (
          <Pressable key={l} onPress={() => quick(n as number)} style={{ flex: 1, minHeight: size.touch - space.md, borderRadius: radius.pill, borderWidth: size.hairline, borderColor: c.borderDefault, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="caption" color="body">{l}</Txt>
          </Pressable>
        ))}
      </View>
      <Txt v="caption" align="center">{a ? `${ymd(a)}${b ? ` — ${ymd(b)}` : ' — tugash kunini tanlang'}` : 'Boshlanish kunini tanlang'}</Txt>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="Bekor" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
        <Button title="Qo'llash" icon="check" disabled={!a} onPress={() => a && onApply(ymd(a), ymd(b ?? a))} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
