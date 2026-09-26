import React from 'react';
import { Pressable, ScrollView, View, ViewStyle } from 'react-native';
import { Badge, IconTile, KPICard, Txt, statusLabel } from '@/design/primitives';
import { Icon, IconName } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { LIST_MODULE, ModuleTone, radius, shadow, size, space, textRoom, type } from '@/design/tokens';
import { Appear, PressScale, stagger } from '@/design/motion';
import type { ErpCard, ErpListFilter, ErpRow } from '@/core/erp';

/**
 * ERP bo'limlarining umumiy bo'laklari — umumiy komponentlar ustida.
 * Nima ko'rsatilishini server hal qiladi; bu yerda faqat chizish.
 */

export { statusLabel };

/** Ro'yxat kaliti → modul toni (ikonka plitkasi foni). */
export const listModule = (key?: string | null): ModuleTone => (key ? LIST_MODULE[key] ?? 'brand' : 'brand');

/** Ro'yxat ustidagi filtr chiplari (Ochiq · 16, Muddati yaqin · 17 …) — server aytadi, bu yerda tanlash. */
export function FilterChips({ filters, onPick }: { filters: ErpListFilter[]; onPick: (key: string) => void }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.sm, paddingRight: space.xs }}>
      {filters.map((f) => (
        <Pressable
          key={f.key} onPress={() => onPick(f.key)} accessibilityRole="tab" accessibilityState={{ selected: !!f.active }}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: size.touch - space.sm, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: f.active ? c.brandSoft : c.bgSurface, borderWidth: size.hairline, borderColor: f.active ? c.brand : c.borderDefault }, pressed && { borderColor: c.borderStrong }]}
        >
          <Txt v="label" color={f.active ? 'brand' : 'body'} numberOfLines={1} style={{ minWidth: textRoom(f.label, type.label.fontSize) }}>{f.label}</Txt>
          <View style={{ minWidth: space.xl, paddingHorizontal: space.xs, borderRadius: radius.pill, backgroundColor: f.active ? c.bgSurface : c.bgMuted, alignItems: 'center' }}>
            <Txt v="caption" color={f.active ? 'brand' : 'muted'}>{f.count}</Txt>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Bosh ko'rsatkich — metric-hero KPI kartasi (sahifada bitta). */
export function HeroCard({ card, note, module: m = 'brand' }: { card: ErpCard; note?: string; module?: ModuleTone }) {
  return (
    <Appear>
      <KPICard hero label={card.label} value={card.value} caption={card.hint ? `${card.hint}${note ? ` · ${note}` : ''}` : note} icon={card.icon ?? 'activity'} module={m} tone={card.tone === 'danger' || card.tone === 'warning' ? card.tone : undefined} />
    </Appear>
  );
}

/** Kichik ko'rsatkich kartochkasi — yonma-yon ikkitadan. */
export function StatTile({ card, index, module: m = 'brand' }: { card: ErpCard; index: number; module?: ModuleTone }) {
  return (
    <Appear delay={stagger(index)} style={{ flexGrow: 0, flexBasis: '48%' }}>
      <KPICard label={card.label} value={card.value} caption={card.hint} icon={card.icon ?? 'activity'} module={m} tone={card.tone === 'danger' || card.tone === 'warning' || card.tone === 'success' ? card.tone : undefined} />
    </Appear>
  );
}

/** Tezkor amal katakchasi — uchtadan qator. */
export function QuickTile({ label, icon, module: m = 'brand', onPress, index }: { label: string; icon: IconName | string; module?: ModuleTone; onPress: () => void; index: number }) {
  const { c } = useTheme();
  return (
    <Appear delay={stagger(index)} style={{ flexGrow: 0, flexBasis: '31.5%' }}>
      <PressScale onPress={onPress} haptic={false} accessibilityRole="button" accessibilityLabel={label}>
        <View style={[{ minHeight: 88, backgroundColor: c.bgSurface, borderWidth: size.hairline, borderColor: c.borderDefault, borderRadius: radius.card, padding: space.md, justifyContent: 'space-between', gap: space.sm }, shadow.card]}>
          <IconTile icon={icon} module={m} size={size.iconTileSm} />
          <Txt v="label" color="strong" numberOfLines={2}>{label}</Txt>
        </View>
      </PressScale>
    </Appear>
  );
}

/** Ro'yxat qatori (karta ko'rinishida) — ikonka plitkasi, sarlavha + izoh, o'ngda qiymat va holat nishoni. */
export function ListRow({ row, icon, module: m = 'brand', onPress, index = 0 }: { row: ErpRow; icon: IconName | string; module?: ModuleTone; onPress?: () => void; index?: number }) {
  const { c } = useTheme();
  const body = (
    <View style={[{ backgroundColor: c.bgSurface, borderWidth: size.hairline, borderColor: c.borderDefault, borderRadius: radius.card, paddingHorizontal: space.md, paddingVertical: space.md, minHeight: size.row + space.lg }, shadow.card]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconTile icon={icon} module={m} />
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong" numberOfLines={1}>{row.title}</Txt>
          {row.subtitle ? <Txt v="caption" numberOfLines={1} style={{ marginTop: 2 }}>{row.subtitle}</Txt> : null}
        </View>
        {/* flexShrink: 0 — uzun nom o'ng ustunni siqib nishon harfini qirqmasin */}
        <View style={{ alignItems: 'flex-end', gap: space.xs, flexShrink: 0 }}>
          {row.right ? <Txt v="bodySm" color="strong" numberOfLines={1} style={{ minWidth: textRoom(row.right, 13) }}>{row.right}</Txt> : null}
          {row.status ? <Badge label={statusLabel(row.status)} tone={row.tone} /> : null}
        </View>
        {onPress ? <Icon name="chevron-right" tone="faint" /> : null}
      </View>
    </View>
  );
  return (
    <Appear delay={stagger(index)} style={{ marginBottom: space.sm }}>
      {onPress ? <PressScale onPress={onPress} scale={0.985} haptic={false} accessibilityRole="button" accessibilityLabel={row.title}>{body}</PressScale> : body}
    </Appear>
  );
}

/** Bo'lim sarlavhasi — title-sm + o'ngda "Hammasi →". */
export function SectionHead({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: ViewStyle }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md, gap: space.sm }, style]}>
      <Txt v="titleSm" numberOfLines={1} style={{ flexShrink: 1 }}>{title}</Txt>
      {action ? (
        <Pressable onPress={onAction} hitSlop={space.sm} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: size.touch, justifyContent: 'center' }}>
          <Txt v="label" color="brand">{action}</Txt>
          <Icon name="arrow-right" tone="brand" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Ro'yxat kaliti → qator ikoni. */
export const ROW_ICON: Record<string, IconName> = {
  orders: 'file-text', sales: 'trending-up', customers: 'users', leads: 'inbox', invoices: 'receipt',
  production: 'package', recipes: 'droplets', tasks: 'square-check', brigades: 'hard-hat',
  trips: 'truck', drivers: 'id-card',
  stock: 'layers', snabjeniye: 'shopping-cart', supply: 'clipboard-list', receipts: 'download', suppliers: 'store',
  cashflow: 'arrow-up-down', payments: 'banknote', employees: 'user',
};
