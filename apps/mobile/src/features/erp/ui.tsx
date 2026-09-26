import React from 'react';
import { ScrollView, View, ViewStyle } from 'react-native';
import { Txt } from '@/design/primitives';
import { Icon, IconName } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { CHIP, INK, erpText, erpTint, textRoom } from '@/design/tokens';
import { Appear, PressScale, stagger } from '@/design/motion';
import type { ErpCard, ErpListFilter, ErpRow } from '@/core/erp';

/**
 * Maketdagi ("ERP Mobil — 9 rol uchun dizayn") bo'laklar.
 * Iliq qog'oz fon, oq kartochkalar, bosh ko'rsatkich qora siyoh blokda,
 * raqamlar mono shriftda — ustma-ust turganda bir chiziqda ko'rinadi.
 */

const toneKey = (t?: string) => (t === 'brand' || t === 'success' || t === 'warning' || t === 'danger' || t === 'info' ? t : 'neutral');

/** Holat chipi — maketdagi rang juftliklari. */
export function Chip({ label, tone }: { label: string; tone?: string }) {
  const [bg, ink] = CHIP[toneKey(tone)];
  return (
    <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: bg, flexShrink: 0 }}>
      {/* Android matn kengligini o'lchaganda bir oz kam chiqaradi (harfiga ~0.2 px), va
          bitta piksel yetmagani uchun butun bir harfni tashlab yuboradi:
          "Yetkazildi" → "Yetkazil…". Harf soniga qarab kichik zaxira beramiz — pill
          shunchaga kengayadi, matn esa to'liq chiqadi. */}
      <Txt style={{ ...erpText.chip, color: ink, flexShrink: 0, minWidth: textRoom(label, 10.5) }} numberOfLines={1}>{label}</Txt>
    </View>
  );
}

/**
 * Ro'yxat ustidagi filtr chiplari (Ochiq · 16, Muddati yaqin · 17 …).
 * Qaysi filtrlar borligini va sanoqni server aytadi — bu yerda faqat chizish va tanlash.
 */
export function FilterChips({ filters, onPick }: { filters: ErpListFilter[]; onPick: (key: string) => void }) {
  const { c } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 7, paddingRight: 4 }}
    >
      {filters.map((f) => (
        <PressScale key={f.key} haptic={false} onPress={() => onPick(f.key)}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            height: 34, paddingHorizontal: 12, borderRadius: 999,
            backgroundColor: f.active ? c.brandPrimary : c.bgSurface,
            borderWidth: 1, borderColor: f.active ? c.brandPrimary : c.border,
          }}>
            <Txt style={{ ...erpText.label, color: f.active ? '#FFFFFF' : c.textPrimary }}>{f.label}</Txt>
            <View style={{ minWidth: 19, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, backgroundColor: f.active ? '#FFFFFF28' : c.bgCanvas, alignItems: 'center' }}>
              <Txt style={{ ...erpText.chip, color: f.active ? '#FFFFFF' : c.textSecondary }}>{f.count}</Txt>
            </View>
          </View>
        </PressScale>
      ))}
    </ScrollView>
  );
}

/** Bosh ko'rsatkich — qora siyoh kartochka. */
export function HeroCard({ card, note }: { card: ErpCard; note?: string }) {
  return (
    <Appear>
      <View style={{ backgroundColor: INK.bg, borderRadius: 16, paddingHorizontal: 17, paddingTop: 16, paddingBottom: 15 }}>
        <Txt style={{ ...erpText.eyebrow, color: INK.muted }}>{card.label}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 7 }}>
          <Txt style={{ ...erpText.hero, color: INK.text }} numberOfLines={1} adjustsFontSizeToFit>{card.value}</Txt>
          {card.hint ? <Txt style={{ fontSize: 13, color: INK.muted }}>{card.hint}</Txt> : null}
        </View>
        {note ? <Txt style={{ fontSize: 11.5, color: INK.muted, marginTop: 11 }}>{note}</Txt> : null}
      </View>
    </Appear>
  );
}

/** Kichik ko'rsatkich kartochkasi — yonma-yon ikkitadan. */
export function StatTile({ card, index }: { card: ErpCard; index: number }) {
  const { c } = useTheme();
  const col = card.tone ? { brand: c.brandPrimary, success: c.success, warning: c.warning, danger: c.danger, info: c.info }[card.tone] : c.textPrimary;
  return (
    <Appear delay={stagger(index, 60)} style={{ flexGrow: 0, flexBasis: '48%' }}>
      <View style={{ backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 13 }}>
        <Txt style={{ ...erpText.label, color: c.textSecondary }} numberOfLines={1}>{card.label}</Txt>
        <Txt style={{ ...erpText.stat, color: col, marginTop: 6 }} numberOfLines={1} adjustsFontSizeToFit>{card.value}</Txt>
        <Txt style={{ fontSize: 11, color: c.textSecondary, marginTop: 4 }} numberOfLines={1}>{card.hint ?? ' '}</Txt>
      </View>
    </Appear>
  );
}

/** Tezkor amal katakchasi — uchtadan qator. */
export function QuickTile({ label, icon, role, onPress, index }: { label: string; icon: IconName; role: Parameters<typeof erpTint>[0]; onPress: () => void; index: number }) {
  const { c, dark } = useTheme();
  return (
    <Appear delay={stagger(index, 50)} style={{ flexGrow: 0, flexBasis: '31.5%' }}>
      <PressScale onPress={onPress} haptic={false}>
        <View style={{ minHeight: 88, backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 10, paddingTop: 11, paddingBottom: 12, justifyContent: 'space-between' }}>
          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: erpTint(role, dark), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={16} color={c.brandPrimary} />
          </View>
          <Txt style={{ ...erpText.label, color: c.textPrimary, lineHeight: 15 }} numberOfLines={2}>{label}</Txt>
        </View>
      </PressScale>
    </Appear>
  );
}

/** Ro'yxat qatori — ikon kvadrati, sarlavha + mono tafsilot, o'ngda qiymat va chip. */
export function ListRow({ row, icon, role, onPress, index = 0 }: { row: ErpRow; icon: IconName; role: Parameters<typeof erpTint>[0]; onPress?: () => void; index?: number }) {
  const { c, dark } = useTheme();
  const body = (
    <View style={{ backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: erpTint(role, dark), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={c.brandPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt style={{ ...erpText.rowTitle, color: c.textPrimary }} numberOfLines={1}>{row.title}</Txt>
          {row.subtitle ? <Txt style={{ ...erpText.meta, color: c.textSecondary, marginTop: 3 }} numberOfLines={1}>{row.subtitle}</Txt> : null}
        </View>
        {/* `flexShrink: 0` — chapdagi uzun nom o'ng ustunni siqib, holat chipining
            oxirgi harfini qirqib yuborardi ("Yetkazild", "Yo'ld"). */}
        <View style={{ alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
          {/* minWidth — chipdagi bilan bir xil sabab: Android o'lchaganda kenglikni kam
              chiqaradi va "20 dona" → "20 d…" bo'lib qolardi */}
          {row.right ? <Txt style={{ fontFamily: erpText.meta.fontFamily, fontSize: 13, color: c.textPrimary, minWidth: textRoom(row.right, 13) }} numberOfLines={1}>{row.right}</Txt> : null}
          {row.status ? <Chip label={statusLabel(row.status)} tone={row.tone} /> : null}
        </View>
      </View>
    </View>
  );
  return (
    <Appear delay={stagger(index)} style={{ marginBottom: 8 }}>
      {onPress ? <PressScale onPress={onPress} scale={0.985} haptic={false}>{body}</PressScale> : body}
    </Appear>
  );
}

/** Bo'lim sarlavhasi — kichik katta harf + o'ngda havola. */
export function SectionHead({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: ViewStyle }) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 11 }, style]}>
      {/* Tor ekranda sarlavha havolaning tagiga kirib qirqilmasin */}
      <Txt numberOfLines={1} style={{ ...erpText.section, color: c.textSecondary, flexShrink: 0, marginRight: 10, minWidth: textRoom(title, 12, 2.1) }}>{title}</Txt>
      {action ? <Txt onPress={onAction} numberOfLines={1} style={{ fontSize: 12, fontFamily: erpText.label.fontFamily, color: c.brandPrimary, flexShrink: 0, minWidth: textRoom(action, 12) }}>{action}</Txt> : null}
    </View>
  );
}

const STATUS: Record<string, string> = {
  DRAFT: 'Qoralama', BLOCKED: 'Bloklangan', CONFIRMED: 'Tasdiqlandi', IN_PRODUCTION: 'Ishlab chiqarishda',
  DELIVERED: 'Yetkazildi', CLOSED: 'Yopildi', CANCELLED: 'Bekor', PLANNED: 'Rejada', LOADED: 'Yuklandi',
  ON_ROAD: "Yo'lda", OPEN: 'Ochiq', PARTIAL: 'Qisman', PAID: "To'landi", NEW: 'Yangi',
  IN_PROGRESS: 'Jarayonda', DONE: 'Bajarildi',
};
export const statusLabel = (s: string) => STATUS[s] ?? s;

/** Ro'yxat kaliti → qator ikoni. */
export const ROW_ICON: Record<string, IconName> = {
  orders: 'document-text-outline', trips: 'bus-outline', tasks: 'checkbox-outline', production: 'cube-outline',
  stock: 'layers-outline', receipts: 'download-outline', invoices: 'receipt-outline',
  cashflow: 'swap-vertical-outline', payments: 'cash-outline', employees: 'person-outline',
};
