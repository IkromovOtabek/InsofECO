import React from 'react';
import { Pressable, View } from 'react-native';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space, toneColors } from '@/design/tokens';
import type { ErpSectionChart } from '@/core/erp';

type Progress = Extract<ErpSectionChart, { kind: 'progress' }>;
type Columns = Extract<ErpSectionChart, { kind: 'columns' }>;

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
