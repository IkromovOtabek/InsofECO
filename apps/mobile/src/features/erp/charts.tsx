import React from 'react';
import { Pressable, View } from 'react-native';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { elevation, radius, size, space, toneColors } from '@/design/tokens';
import type { ErpSectionChart } from '@/core/erp';

type Progress = Extract<ErpSectionChart, { kind: 'progress' }>;

/**
 * Plan / fakt — har ko'rsatkich: nomi, foiz (katta), chiziq (plan = to'liq), ostida fakt va plan raqami.
 * Chiziq rangi — holat (norma / e'tibor / kritik), serverdagi chegaralar bo'yicha. Plani yo'q
 * ko'rsatkich (qarz, brak) — chiziqsiz, faqat raqam.
 */
export function ProgressChart({ chart, onOpen }: { chart: Progress; onOpen?: (list: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.card, paddingVertical: space.xs }, elevation(c).sh1]}>
      {chart.items.map((it, i) => {
        const t = toneColors(c, it.tone);
        const w = it.pct == null ? null : Math.max(2, Math.min(100, it.pct));
        const body = (
          <View style={{ paddingVertical: space.md, gap: space.xs, borderTopWidth: i ? size.hairline : 0, borderTopColor: c.borderSubtle }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
              <Txt v="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{it.label}</Txt>
              {it.pct != null ? <Txt v="titleSm" style={{ color: t.ink }}>{it.pct}%</Txt> : <Txt v="bodyStrong" style={{ color: t.ink }}>{it.fact}</Txt>}
              {it.open ? <Icon name="chevron-right" tone="faint" size={size.iconSm} /> : null}
            </View>
            {w != null ? (
              <View style={{ height: space.sm, borderRadius: radius.pill, backgroundColor: c.chartTrack, overflow: 'hidden' }}>
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
