import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Card, IconButton, Txt, type TxtColor } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';

/**
 * Jadval — chapda qotirilgan ustun (ism / sana), o'ngdagi ustunlar gorizontal suriladi.
 * 360 dp telefonda ham sig'adi: ekran kengligidan oshgan qismi suriladi, sahifa esa yon tomonga chiqmaydi.
 * Qatorlar balandligi qat'iy (chap va o'ng qism bir xil turishi uchun) — matn bir qatorga qisqaradi.
 */

export interface Cell { text: string; color?: TxtColor; strong?: boolean }
export interface Col<T> {
  key: string;
  title: string;
  /** Ustun kengligi, dp. */ width: number;
  align?: 'left' | 'right' | 'center';
  cell: (r: T) => Cell | string | null;
}

const ROW_H = 52;
const HEAD_H = 36;

export function DataTable<T>({ rows, rowKey, leadTitle, leadWidth = 136, lead, cols, onRow }: {
  rows: T[];
  rowKey: (r: T) => string;
  leadTitle: string;
  leadWidth?: number;
  /** Chap ustun: sarlavha va izoh (lavozim, mashina...). */ lead: (r: T) => { title: string; sub?: string | null; color?: TxtColor };
  cols: Col<T>[];
  onRow?: (r: T) => void;
}) {
  const { c } = useTheme();
  const line = { borderTopWidth: size.hairline, borderTopColor: c.borderSubtle };
  const headBg = { backgroundColor: c.bgSubtle };
  const cellOf = (v: Cell | string | null): Cell => (v == null ? { text: '—', color: 'faint' } : typeof v === 'string' ? { text: v } : v);
  const press = (r: T) => (onRow ? () => onRow(r) : undefined);
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: leadWidth, borderRightWidth: size.hairline, borderRightColor: c.borderSubtle }}>
          <View style={[{ height: HEAD_H, justifyContent: 'center', paddingHorizontal: space.md }, headBg]}>
            <Txt v="overlineXs" numberOfLines={1}>{leadTitle}</Txt>
          </View>
          {rows.map((r) => {
            const l = lead(r);
            return (
              <Pressable
                key={rowKey(r)} onPress={press(r)} disabled={!onRow} accessibilityRole={onRow ? 'button' : undefined}
                android_ripple={{ color: c.bgMuted }}
                style={({ pressed }) => [{ height: ROW_H, justifyContent: 'center', paddingHorizontal: space.md }, line, pressed && { backgroundColor: c.bgSubtle }]}
              >
                <Txt v="label" color={l.color ?? 'strong'} numberOfLines={1}>{l.title}</Txt>
                {l.sub ? <Txt v="caption" numberOfLines={1}>{l.sub}</Txt> : null}
              </Pressable>
            );
          })}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flexGrow: 1 }}>
            <View style={[{ height: HEAD_H, flexDirection: 'row', alignItems: 'center', paddingRight: space.sm }, headBg]}>
              {cols.map((col) => (
                <Txt key={col.key} v="overlineXs" numberOfLines={1} align={col.align ?? 'left'} style={{ width: col.width, paddingHorizontal: space.sm }}>{col.title}</Txt>
              ))}
            </View>
            {rows.map((r) => (
              <Pressable
                key={rowKey(r)} onPress={press(r)} disabled={!onRow}
                android_ripple={{ color: c.bgMuted }}
                style={({ pressed }) => [{ height: ROW_H, flexDirection: 'row', alignItems: 'center', paddingRight: space.sm }, line, pressed && { backgroundColor: c.bgSubtle }]}
              >
                {cols.map((col) => {
                  const v = cellOf(col.cell(r));
                  return (
                    <Txt
                      key={col.key} v={v.strong ? 'bodyStrong' : 'bodySm'} color={v.color} numberOfLines={1} align={col.align ?? 'left'}
                      style={{ width: col.width, paddingHorizontal: space.sm, fontVariant: ['tabular-nums'] }}
                    >
                      {v.text}
                    </Txt>
                  );
                })}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </Card>
  );
}

/** Davr almashtirgich: ‹ sarlavha › — kun yoki oy uchun. `next` yo'q bo'lsa (kelajak) o'ng tugma o'chiq. */
export function PeriodSwitch({ title, sub, onPrev, onNext }: { title: string; sub?: string; onPrev: () => void; onNext?: (() => void) | null }) {
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.sm }}>
      <IconButton icon="chevron-left" label="Oldingi" onPress={onPrev} />
      <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
        <Txt v="titleSm" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{title}</Txt>
        {sub ? <Txt v="caption" numberOfLines={1}>{sub}</Txt> : null}
      </View>
      <IconButton icon="chevron-right" label="Keyingi" onPress={onNext ?? undefined} disabled={!onNext} tone={onNext ? 'body' : 'faint'} />
    </Card>
  );
}
