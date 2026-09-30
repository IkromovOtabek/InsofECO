import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space, toneColors } from '@/design/tokens';
import type { ErpSectionChart } from '@/core/erp';

type Progress = Extract<ErpSectionChart, { kind: 'progress' }>;
type Columns = Extract<ErpSectionChart, { kind: 'columns' }>;
type Bars = Extract<ErpSectionChart, { kind: 'bars' }>;
type Donut = Extract<ErpSectionChart, { kind: 'donut' }>;

/**
 * Plan / fakt — har ko'rsatkich: nomi, foiz (katta), chiziq (plan = to'liq), ostida fakt va plan raqami.
 * Chiziq rangi — holat (norma / e'tibor / kritik), serverdagi chegaralar bo'yicha. Plani yo'q
 * ko'rsatkich (qarz, brak) — chiziqsiz, faqat raqam.
 */
export function ProgressChart({ chart, onOpen }: { chart: Progress; onOpen?: (list: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderWidth: size.hairline, borderColor: c.borderDefault, paddingHorizontal: space.card, paddingVertical: space.sm }, shadow.card]}>
      {chart.items.map((it, i) => {
        const t = toneColors(c, it.tone);
        const w = it.pct == null ? null : Math.max(2, Math.min(100, it.pct));
        const body = (
          <View style={{ paddingVertical: space.md, gap: space.xs, borderTopWidth: i ? size.hairline : 0, borderTopColor: c.borderDefault }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
              <Txt v="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{it.label}</Txt>
              {it.pct != null ? <Txt v="titleSm" style={{ color: t.ink }}>{it.pct}%</Txt> : <Txt v="bodyStrong" style={{ color: t.ink }}>{it.fact}</Txt>}
              {it.open ? <Icon name="chevron-right" tone="faint" size={size.iconSm} /> : null}
            </View>
            {w != null ? (
              <View style={{ height: space.sm, borderRadius: radius.pill, backgroundColor: c.bgMuted, overflow: 'hidden' }}>
                <View style={{ width: `${w}%`, height: '100%', borderRadius: radius.pill, backgroundColor: t.solid }} />
              </View>
            ) : null}
            <Txt v="caption">{`fakt ${it.fact}${it.plan != null ? ` · plan ${it.plan}` : ''}${it.pct != null && it.pct > 100 ? (it.invert ? ' · rejadan oshdi' : ' · rejadan ortiq') : ''}`}</Txt>
          </View>
        );
        return it.open && onOpen
          ? <Pressable key={it.label} accessibilityRole="button" onPress={() => onOpen(it.open!)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>{body}</Pressable>
          : <View key={it.label}>{body}</View>;
      })}
    </View>
  );
}

/** Oylar bo'yicha guruhli ustunlar (tushum / foyda / xarajat) — ustida qisqa raqam, ostida oy. */
export function ColumnsChart({ chart, height = 160 }: { chart: Columns; height?: number }) {
  const { c } = useTheme();
  const colors = [c.chart1, c.chart3, c.chart4, c.chart2];
  const max = Math.max(1, ...chart.groups.flatMap((g) => g.values));
  const plot = height - space.xxl;
  return (
    <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderWidth: size.hairline, borderColor: c.borderDefault, padding: space.card, gap: space.md }, shadow.card]} accessibilityRole="image" accessibilityLabel="Oylar bo'yicha ustunli grafik">
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: space.md }}>
        {chart.groups.map((g) => (
          <View key={g.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, height: plot }}>
              {g.values.map((v, i) => (
                <View key={i} style={{ alignItems: 'center', justifyContent: 'flex-end', height: plot }}>
                  <Txt v="caption" numberOfLines={1} style={{ marginBottom: space.xs }}>{g.texts[i]}</Txt>
                  <View style={{ width: space.lg, height: Math.max(2, ((plot - space.xl) * v) / max), borderTopLeftRadius: radius.xs, borderTopRightRadius: radius.xs, backgroundColor: colors[i % colors.length] }} />
                </View>
              ))}
            </View>
            <Txt v="bodyStrong" style={{ marginTop: space.xs }} numberOfLines={1}>{g.label}</Txt>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg }}>
        {chart.series.map((s, i) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <View style={{ width: space.md, height: space.md, borderRadius: radius.xs, backgroundColor: colors[i % colors.length] }} />
            <Txt v="caption">{s.label}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Davr bo'yicha ustunlar (rol dashboardi): 24 soat / 7 kun / 30 kun / 12 oy. Ustun bosilsa tepada
 * shu savatning raqamlari chiqadi, qolganlari xiralashadi; yana bosilsa jami qaytadi.
 * Pastki yozuvlar siqilib ketmasin deb ko'p savatda har N-chisi ko'rsatiladi.
 */
export function BarsChart({ chart, height = 150 }: { chart: Bars; height?: number }) {
  const { c } = useTheme();
  const [sel, setSel] = useState<number | null>(null);
  const colors = [c.chart1, c.chart2, c.chart3, c.chart4];
  const max = Math.max(1, ...chart.points.flatMap((p) => p.values));
  const plot = height - space.xl;
  const n = chart.points.length;
  const every = n <= 8 ? 1 : n <= 16 ? 2 : Math.ceil(n / 6);
  const picked = sel != null ? chart.points[sel] : null;
  const gridLines = [0, 1, 2, 3];
  return (
    <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderWidth: size.hairline, borderColor: c.borderDefault, padding: space.card, gap: space.md }, shadow.card]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm, minHeight: space.xl }}>
        <Txt v="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{picked ? picked.label : chart.total ?? ''}</Txt>
        <Txt v="caption" numberOfLines={1} color={picked ? 'strong' : 'muted'}>{picked ? picked.texts.join(' · ') : 'ustunni bosing'}</Txt>
      </View>
      <View accessibilityRole="image" accessibilityLabel="Davr bo'yicha ustunli grafik">
        <View pointerEvents="none" style={{ height: plot, justifyContent: 'space-between', position: 'absolute', left: 0, right: 0, top: 0 }}>
          {gridLines.map((i) => <View key={i} style={{ height: size.hairline, backgroundColor: c.chartGrid }} />)}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: plot, gap: 2 }}>
          {chart.points.map((p, i) => (
            <Pressable
              key={`${p.label}-${i}`} onPress={() => setSel(sel === i ? null : i)} accessibilityRole="button" accessibilityLabel={`${p.label}: ${p.texts.join(', ')}`}
              style={{ flex: 1, height: plot, flexDirection: 'row', alignItems: 'flex-end', gap: 2, opacity: sel != null && sel !== i ? 0.35 : 1 }}
            >
              {p.values.map((v, j) => (
                <View key={j} style={{ flex: 1, height: Math.max(v > 0 ? 3 : 2, (plot * v) / max), borderTopLeftRadius: radius.xs, borderTopRightRadius: radius.xs, backgroundColor: v > 0 ? colors[j % colors.length] : c.chartTrack }} />
              ))}
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 2, marginTop: space.xs }}>
          {chart.points.map((p, i) => (
            <Txt key={`${p.label}-${i}`} v="caption" align="center" numberOfLines={1} color={sel === i ? 'strong' : 'muted'} style={{ flex: 1 }}>{sel === i || i % every === 0 ? p.label : ''}</Txt>
          ))}
        </View>
      </View>
      {chart.series.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg }}>
          {chart.series.map((s, i) => (
            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <View style={{ width: space.md, height: space.md, borderRadius: radius.xs, backgroundColor: colors[i % colors.length] }} />
              <Txt v="caption">{s.label}</Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Halqa o'lchamlari — SVG koordinatalari (piksel emas, chizma birligi). */
const RING = 100;
const RING_R = 40;
const RING_W = 14;

/**
 * Ulushlar halqasi: har bo'lak — bitta yoy, markazda jami. Ostida ro'yxat: rang, nom, foiz, qiymat.
 * Bo'lak yoki qator bosilsa markazda shu bo'lakning raqami chiqadi.
 */
export function DonutChart({ chart }: { chart: Donut }) {
  const { c } = useTheme();
  const [sel, setSel] = useState<number | null>(null);
  const colors = [c.chart1, c.chart2, c.chart3, c.chart4, c.textMuted];
  const total = chart.items.reduce((s, i) => s + i.value, 0) || 1;
  const circ = 2 * Math.PI * RING_R;
  const gap = chart.items.length > 1 ? 2 : 0;
  let offset = 0;
  const arcs = chart.items.map((it, i) => {
    const len = Math.max(0, (it.value / total) * circ - gap);
    const arc = { key: i, len, offset, color: colors[i % colors.length] };
    offset += (it.value / total) * circ;
    return arc;
  });
  const picked = sel != null ? chart.items[sel] : null;
  return (
    <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderWidth: size.hairline, borderColor: c.borderDefault, padding: space.card, gap: space.md }, shadow.card]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <Pressable onPress={() => setSel(null)} accessibilityRole="image" accessibilityLabel={`Ulushlar: ${chart.items.map((i) => `${i.label} ${i.text}`).join(', ')}`} style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={120} height={120} viewBox={`0 0 ${RING} ${RING}`}>
            <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={c.chartTrack} strokeWidth={RING_W} fill="none" />
            {arcs.map((a) => (
              <Circle
                key={a.key} cx={RING / 2} cy={RING / 2} r={RING_R} fill="none"
                stroke={a.color} strokeWidth={sel === a.key ? RING_W + 3 : RING_W} strokeOpacity={sel != null && sel !== a.key ? 0.35 : 1}
                strokeDasharray={`${a.len} ${circ - a.len}`} strokeDashoffset={-a.offset}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            ))}
          </Svg>
          <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', paddingHorizontal: space.md }}>
            <Txt v="titleSm" numberOfLines={1} adjustsFontSizeToFit>{picked ? `${Math.round((picked.value / total) * 100)}%` : chart.total}</Txt>
            <Txt v="caption" numberOfLines={1}>{picked ? picked.label : chart.totalLabel ?? 'jami'}</Txt>
          </View>
        </Pressable>
        <View style={{ flex: 1, gap: space.xs }}>
          {chart.items.map((it, i) => (
            <Pressable
              key={`${it.label}-${i}`} onPress={() => setSel(sel === i ? null : i)} accessibilityRole="button" accessibilityLabel={`${it.label}: ${it.text}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: space.xxl, opacity: sel != null && sel !== i ? 0.5 : 1 }}
            >
              <View style={{ width: size.dot + 2, height: size.dot + 2, borderRadius: radius.xs / 2, backgroundColor: colors[i % colors.length] }} />
              <Txt v="bodySm" numberOfLines={1} style={{ flex: 1 }}>{it.label}</Txt>
              <Txt v="caption">{Math.round((it.value / total) * 100)}%</Txt>
              <Txt v="bodyStrong" numberOfLines={1}>{it.text}</Txt>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
