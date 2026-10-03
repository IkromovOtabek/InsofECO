import React from 'react';
import { Image, Pressable, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, SearchField, Txt, fmtNum } from '@/design/primitives';
import { Icon, type IconName } from '@/design/icons';
import { PressScale, haptic } from '@/design/motion';
import { toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { elevation, radius, size, space, type as typeScale } from '@/design/tokens';
import { useSession } from '@/core/session';
import type { ShopItem } from './api';
import { ProductImage } from './art';
import { useCart } from './cart';

/** Kichik belgi (sarlavha, zavod logotipi) — ilova ikonkasi. */
export const LOGO_MARK = require('../../../assets/icon.png') as number;

/** Mahsulot kartasidagi rasm maydoni — demo `.pimg` 16:11. */
export const CARD_PHOTO_RATIO = 16 / 11;

/** Bildirishnomalar — faqat kirgan foydalanuvchida haqiqiy ro'yxat bor; mehmonda qo'ng'iroq yo'q. */
function useBellTarget(): string | null {
  return useSession((s) => {
    if (s.status !== 'authed') return null;
    if (s.kind === 'erp') return '/erp/bildirishnomalar';
    if (s.kind === 'eco' && s.active?.role === 'TADBIRKOR') return '/(tadbirkor)/notifications';
    return null;
  });
}

/**
 * Do'kon sarlavhasi — demo `shopHead()`: logotip plitkasi + pill qidiruv + qo'ng'iroq.
 * `onSearchPress` berilsa qidiruv bosiladigan "ko'rinish" (katalogga o'tadi), aks holda haqiqiy maydon.
 */
export function ShopTopBar({ search, onSearch, onSearchPress, autoFocus }: {
  search?: string; onSearch?: (s: string) => void; onSearchPress?: () => void; autoFocus?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bell = useBellTarget();
  const field = (
    <SearchField
      value={search ?? ''}
      onChangeText={onSearch ?? (() => undefined)}
      placeholder="Beton, gazoblok, plita…"
      autoFocus={autoFocus}
      editable={!onSearchPress}
      accessibilityLabel="Mahsulot qidirish"
    />
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.tight, paddingTop: insets.top + space.sm, paddingBottom: space.md, paddingHorizontal: space.pageX }}>
      <Image source={LOGO_MARK} style={{ width: size.headerAvatar, height: size.headerAvatar, borderRadius: radius.sm }} resizeMode="cover" accessibilityLabel="Insof" />
      {onSearchPress ? (
        <Pressable accessibilityRole="search" accessibilityLabel="Mahsulot qidirish" onPress={onSearchPress} style={{ flex: 1 }}>
          <View pointerEvents="none">{field}</View>
        </Pressable>
      ) : <View style={{ flex: 1 }}>{field}</View>}
      {bell ? <IconButton icon="bell" label="Bildirishnomalar" onPress={() => router.push(bell as never)} /> : null}
    </View>
  );
}

/** Narx: "780 000 so'm/m³" — demo `.pprice` (qalin raqam + kichik birlik). */
export function Price({ value, unit, big }: { value: number; unit: string; big?: boolean }) {
  return (
    <Txt v={big ? 'metric' : 'listTitle'} numberOfLines={1} style={{ flexShrink: 1 }}>
      {fmtNum(value)}
      <Txt v="caption">{` so'm/${unit}`}</Txt>
    </Txt>
  );
}

/** Demo `.padd`: 36 dp brend doira "+" — mahsulotni savatga qo'shadi (eng kam hajm bilan). */
export function AddButton({ item }: { item: ShopItem }) {
  const { c } = useTheme();
  const add = useCart((s) => s.add);
  return (
    <PressScale
      onPress={() => { add(item, item.minQty ?? 1); haptic.success(); toast.success(`${item.name} — ${fmtNum(item.minQty ?? 1)} ${item.unitLabel}`, "Savatga qo'shildi"); }}
      accessibilityRole="button" accessibilityLabel={`${item.name} — savatga qo'shish`} hitSlop={space.xs}
    >
      <View style={[{ width: size.iconTile - space.xs, height: size.iconTile - space.xs, borderRadius: radius.pill, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }, elevation(c).chipGlow(c.brand)]}>
        <Icon name="plus" size={size.iconMd - 2} color={c.textOnBrand} strokeWidth={2.25} />
      </View>
    </PressScale>
  );
}

/**
 * Mahsulot kartasi — demo `pcard`: rasm maydoni (16:11, bgMuted, ichki 8 dp) + ustida brend teg,
 * guruh (t-sm), 2 qatorli nom, narx birligi bilan va "+" (savatga). Karta bosilsa — mahsulot sahifasi.
 */
export function ProductCard({ item, onPress, width }: { item: ShopItem; onPress: () => void; width?: number }) {
  const { c } = useTheme();
  return (
    <PressScale
      onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.name}, ${fmtNum(item.price)} so'm/${item.unitLabel}`}
      style={[{ flex: width ? undefined : 1, width, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous' }, elevation(c).sh1]}
    >
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }}>
        <View style={{ aspectRatio: CARD_PHOTO_RATIO, backgroundColor: c.bgMuted, padding: space.sm }}>
          <ProductImage item={item} />
          {item.badge ? (
            <View style={{ position: 'absolute', left: space.sm + 2, top: space.sm + 2, paddingHorizontal: space.sm + 2, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.brand }}>
              <Txt v="badge" numberOfLines={1} style={{ color: c.textOnBrand }}>{item.badge}</Txt>
            </View>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: space.md, paddingTop: space.tight, paddingBottom: space.md, gap: space.xs }}>
          <Txt v="tSm" numberOfLines={1}>{item.group ?? item.code}</Txt>
          <Txt v="bodyStrong" numberOfLines={2} style={{ minHeight: typeScale.bodyStrong.lineHeight * 2 }}>{item.name}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}><Price value={item.price} unit={item.unitLabel} /></View>
            <AddButton item={item} />
          </View>
        </View>
      </View>
    </PressScale>
  );
}

/** Ikki ustunli setka — demo `.pgrid` (ScrollView ichida). */
export function ProductGrid({ items, onOpen }: { items: ShopItem[]; onOpen: (id: string) => void }) {
  return (
    <View style={{ gap: space.md }}>
      {Array.from({ length: Math.ceil(items.length / 2) }, (_, r) => {
        const row = items.slice(r * 2, r * 2 + 2);
        return (
          <View key={r} style={{ flexDirection: 'row', gap: space.md }}>
            {row.map((it) => <ProductCard key={it.id} item={it} onPress={() => onOpen(it.id)} />)}
            {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

/** Kichik ro'yxat rasmi — demo `.mini` (40×32 css → 56×44, bgMuted). */
export function MiniArt({ item }: { item: Parameters<typeof ProductImage>[0]['item'] }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size.avatarLg, height: size.touch, borderRadius: radius.sm, backgroundColor: c.bgMuted, padding: 3, overflow: 'hidden' }}>
      <ProductImage item={item} />
    </View>
  );
}

/** Kichik chip — demo katalog qatoridagi "Arzonroq" / "Filtr" (36 dp, yuza + sh1). */
export function MiniChip({ label, icon, active, onPress, hint }: { label: string; icon: IconName; active?: boolean; onPress: () => void; hint?: string }) {
  const { c } = useTheme();
  return (
    <PressScale
      accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ selected: !!active }}
      haptic={false} onPress={() => { haptic.selection(); onPress(); }} hitSlop={{ top: space.xs, bottom: space.xs }}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, height: size.touch - space.sm, paddingHorizontal: space.md + 2, borderRadius: radius.pill, backgroundColor: active ? c.brandSoft : c.bgSurface }, elevation(c).sh1]}
    >
      <Icon name={icon} size={size.iconSm} tone={active ? 'brand' : 'body'} />
      <Txt v="label" color={active ? 'brand' : 'body'}>{label}</Txt>
    </PressScale>
  );
}

/** Rasm/muqova ustidagi suzuvchi dumaloq tugma (orqaga, saralash). */
export function FloatingButton({ icon, label, onPress, style, active }: { icon: IconName; label: string; onPress: () => void; style?: StyleProp<ViewStyle>; active?: boolean }) {
  return <IconButton icon={icon} label={label} onPress={onPress} variant="secondary" tone="strong" style={style} active={active} />;
}

/**
 * Hajm tanlagich — demo `.stepper`: bgMuted pill, ichida oq dumaloq − / + (sh1) va qiymat.
 * Qiymatni qo'lda ham yozish mumkin (12,5). `min` dan pastga tushmaydi.
 */
export function QtyStepper({ value, onChange, unit, min = 1, step = 1, compact }: { value: string; onChange: (v: string) => void; unit: string; min?: number; step?: number; compact?: boolean }) {
  const { c } = useTheme();
  const n = Number(value.replace(',', '.'));
  const cur = Number.isFinite(n) ? n : 0;
  const bump = (d: number) => {
    haptic.selection();
    onChange(String(Math.max(min, Math.round((cur + d) * 10) / 10)));
  };
  const b = compact ? size.iconTileSm : size.tile;
  const btn = (icon: IconName, label: string, d: number, disabled?: boolean) => (
    <PressScale
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} haptic={false} scale={0.9}
      onPress={() => bump(d)} hitSlop={(size.touch - b) / 2 + 2}
      style={[{ width: b, height: b, borderRadius: radius.pill, backgroundColor: c.bgSurface, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1 }, elevation(c).sh1]}
    >
      <Icon name={icon} size={compact ? size.iconSm : size.iconMd - 2} tone="strong" strokeWidth={2.5} />
    </PressScale>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.xs, borderRadius: radius.pill, backgroundColor: c.bgMuted }}>
      {btn('minus', 'Kamaytirish', -step, cur <= min)}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 2, minWidth: compact ? space.x10 : space.x12 + space.sm }}>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          selectTextOnFocus
          accessibilityLabel={`Hajm, ${unit}`}
          style={[compact ? typeScale.bodyStrong : typeScale.listTitle, { color: c.textStrong, textAlign: 'right', minWidth: space.lg, padding: 0 }]}
        />
        <Txt v={compact ? 'caption' : 'bodyStrong'} color="strong">{unit}</Txt>
      </View>
      {btn('plus', "Ko'paytirish", step)}
    </View>
  );
}
