import React from 'react';
import { Pressable, ScrollView, View, ViewStyle } from 'react-native';
import { Badge, IconTile, KPICard, Txt, statusLabel } from '@/design/primitives';
import { Icon, IconName } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { LIST_MODULE, ModuleTone, radius, shadow, size, space, textRoom, toneColors, type } from '@/design/tokens';
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
/** Karta bosilganda qayerga borishi — server `open` beradi (batafsil kartochka yoki ro'yxat). */
export const cardHref = (card: ErpCard) => (card.open ? (card.open.id ? `/erp/${card.open.key}/${card.open.id}` : `/erp/list/${card.open.key}`) : null);

export function HeroCard({ card, note, module: m = 'brand', busy, onOpen }: { card: ErpCard; note?: string; module?: ModuleTone; busy?: boolean; onOpen?: (href: string) => void }) {
  const href = cardHref(card);
  return (
    <Appear>
      <KPICard hero label={card.label} value={busy ? '…' : card.value} caption={card.hint ? `${card.hint}${note ? ` · ${note}` : ''}` : note} icon={card.icon ?? 'activity'} module={m} tone={card.tone === 'danger' || card.tone === 'warning' ? card.tone : undefined} onPress={href && onOpen ? () => onOpen(href) : undefined} />
    </Appear>
  );
}

/**
 * Davr filtri (Bugun · Hafta · Oy · Yil · Kalendar) — bosh ekranning eng tepasida, gorizontal.
 * "Kalendar" bosilsa oraliq tanlash paneli ochiladi; tanlangan oraliq tugma yozuvida ko'rinadi.
 */
export function CardFilters({ card, onFilter, onCalendar, calendarOpen }: { card: ErpCard; onFilter: (key: string) => void; onCalendar: () => void; calendarOpen: boolean }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} accessibilityRole="tablist">
      {card.filters!.map((f) => {
        const isCal = f.key === 'custom';
        const on = f.active || (isCal && calendarOpen);
        return (
          <Pressable
            key={f.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${card.label}: ${f.label}`}
            onPress={() => (isCal ? onCalendar() : !f.active && onFilter(f.key))}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: size.touch - space.sm, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: size.hairline, borderColor: on ? c.brand : c.borderDefault, backgroundColor: on ? c.brand : c.bgSurface, opacity: pressed ? 0.7 : 1 })}
          >
            {isCal ? <Icon name="calendar-days" size={size.iconSm} color={on ? c.textOnBrand : c.textBody} /> : null}
            <Txt v="bodyStrong" style={{ color: on ? c.textOnBrand : c.textBody }}>{f.label}</Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Kichik ko'rsatkich kartochkasi — yonma-yon ikkitadan. */
export function StatTile({ card, index, module: m = 'brand', onOpen }: { card: ErpCard; index: number; module?: ModuleTone; onOpen?: (href: string) => void }) {
  const href = cardHref(card);
  return (
    <Appear delay={stagger(index)} style={{ flexGrow: 0, flexBasis: '48%' }}>
      <KPICard label={card.label} value={card.value} caption={card.hint} icon={card.icon ?? 'activity'} module={m} tone={card.tone === 'danger' || card.tone === 'warning' || card.tone === 'success' ? card.tone : undefined} onPress={href && onOpen ? () => onOpen(href) : undefined} />
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
  // Pul qatori (+kirim / −chiqim) holat nishonisiz keladi — summa yirik, qalin va yashil/qizil bo'ladi
  const money = !!row.right && !row.status && (row.tone === 'success' || row.tone === 'danger');
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
          {row.right ? (
            <Txt v={money ? 'titleSm' : 'bodySm'} color="strong" numberOfLines={1} style={[{ minWidth: textRoom(row.right, money ? 16 : 13) }, money ? { color: toneColors(c, row.tone).ink } : null]}>{row.right}</Txt>
          ) : null}
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
  production: 'package', recipes: 'droplets', tasks: 'square-check', brigades: 'hard-hat', 'prod-report': 'file-text', 'sex-emp': 'user',
  'brig-issues': 'triangle-alert', 'brig-issue': 'triangle-alert', 'brig-shifts': 'clipboard-check', 'brig-shift': 'clipboard-check',
  trips: 'truck', drivers: 'id-card',
  stock: 'layers', snabjeniye: 'shopping-cart', supply: 'clipboard-list', receipts: 'download', suppliers: 'store',
  cashflow: 'arrow-up-down', payments: 'banknote', employees: 'user',
  approvals: 'circle-check', activity: 'activity',
};
