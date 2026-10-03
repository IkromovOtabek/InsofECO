import React from 'react';
import { Image, Pressable, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, IconButton, Txt, fmtNum } from '@/design/primitives';
import { Icon, type IconName } from '@/design/icons';
import { PressScale, haptic } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space, type as typeScale } from '@/design/tokens';
import { photoUrl, type ShopItem } from '@/features/shop/api';

/** Kichik belgi (sarlavha, sotuvchi qatori, zavod logotipi) — ilova ikonkasi. */
export const LOGO_MARK = require('../../../assets/icon.png') as number;

/** Surat nisbati — kartada 16:11 (chizma bo'yicha), kartochkada 4:3. */
export const CARD_PHOTO_RATIO = 16 / 11;
export const PHOTO_RATIO = 4 / 3;

/**
 * Mahsulot surati yoki neytral joy egallovchi (bgMuted + ikonka). Rasm yo'q bo'lsa ham
 * karta tartibi buzilmaydi; rang faqat tokenlardan.
 */
export function ProductArt({ photo, ratio = CARD_PHOTO_RATIO, iconSize = size.iconXl, badge, style }: {
  photo: string | null; ratio?: number; iconSize?: number; badge?: string | null; style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const uri = photoUrl(photo);
  return (
    <View style={[{ aspectRatio: ratio, backgroundColor: c.bgMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Icon name="package" size={iconSize} tone="faint" />
      )}
      {badge ? <Badge label={badge} tone="brand" icon={null} style={{ position: 'absolute', top: space.sm, left: space.sm }} /> : null}
    </View>
  );
}

/**
 * Do'kon sarlavhasi — kichik logotip + qidiruv. `onSearchPress` berilsa qidiruv "soxta" maydon
 * (bosilganda katalogga o'tadi); aks holda haqiqiy kiritish (`search` / `onSearch`).
 */
export function ShopTopBar({ search, onSearch, onSearchPress, autoFocus, inputRef, right }: {
  search?: string; onSearch?: (s: string) => void; onSearchPress?: () => void; autoFocus?: boolean; inputRef?: React.Ref<TextInput>; right?: React.ReactNode;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const pill: ViewStyle = { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.touch, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: c.bgSurface, ...shadow.card };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: insets.top + space.sm, paddingBottom: space.md, paddingHorizontal: space.pageX, backgroundColor: c.bgApp }}>
      <Image source={LOGO_MARK} style={{ width: size.iconTile, height: size.iconTile, borderRadius: radius.md }} resizeMode="cover" accessibilityLabel="Insof JBI" />
      {onSearchPress ? (
        <Pressable accessibilityRole="search" accessibilityLabel="Mahsulot qidirish" onPress={onSearchPress} style={({ pressed }) => [pill, pressed && { opacity: 0.8 }]}>
          <Icon name="search" tone="muted" />
          <Txt v="bodySm" color="faint" numberOfLines={1} style={{ flex: 1 }}>Beton, gazoblok, plita…</Txt>
        </Pressable>
      ) : (
        <View style={pill}>
          <Icon name="search" tone="muted" />
          <TextInput
            ref={inputRef}
            value={search}
            onChangeText={onSearch}
            autoFocus={autoFocus}
            placeholder="Beton, gazoblok, plita…"
            placeholderTextColor={c.textFaint}
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Mahsulot qidirish"
            style={[typeScale.bodySm, { flex: 1, color: c.textStrong, paddingVertical: space.sm }]}
          />
        </View>
      )}
      {right}
    </View>
  );
}

/** Sotuvchi (zavod) qatori — kichik logotip + nom. Bosilsa zavod profili ochiladi. */
export function SellerChip({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Sotuvchi: ${name}`} onPress={onPress} hitSlop={space.sm}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', paddingVertical: space.xs, opacity: pressed ? 0.6 : 1 })}>
      <Image source={LOGO_MARK} style={{ width: size.iconLg, height: size.iconLg, borderRadius: radius.pill }} resizeMode="cover" />
      <Txt v="caption" color="body" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Txt>
      <Icon name="chevron-right" tone="faint" size={size.iconSm} />
    </Pressable>
  );
}

/** Narx: "780 000 so'm/m³". */
export function Price({ value, unit, big }: { value: number; unit: string; big?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs, flexShrink: 1, flexWrap: 'wrap' }}>
      <Txt v={big ? 'metric' : 'bodyStrong'} numberOfLines={1}>{fmtNum(value)}</Txt>
      <Txt v="caption" numberOfLines={1}>so&apos;m/{unit}</Txt>
    </View>
  );
}

/**
 * Mahsulot kartasi (chizma "pcard"): surat 16:11, guruh, 2 qatorli nom, narx birligi bilan va
 * dumaloq "+" belgi. Savat yo'q — karta (va "+") mahsulot sahifasini, ya'ni buyurtmani ochadi.
 */
export function ProductCard({ item, onPress, width }: { item: ShopItem; onPress: () => void; width?: number }) {
  const { c } = useTheme();
  return (
    <PressScale
      onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.name}, ${fmtNum(item.price)} so'm/${item.unitLabel}`}
      accessibilityHint="Mahsulot sahifasi va buyurtma"
      style={[{ flex: width ? undefined : 1, width, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous' }, shadow.card]}
    >
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }}>
        <ProductArt photo={item.photo} badge={item.badge} />
        <View style={{ padding: space.md, gap: space.xs }}>
          <Txt v="caption" numberOfLines={1}>{[item.group, item.strengthClass].filter(Boolean).join(' · ') || item.code}</Txt>
          <Txt v="bodyStrong" numberOfLines={2} style={{ minHeight: typeScale.bodyStrong.lineHeight * 2 }}>{item.name}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.sm, marginTop: space.xs }}>
            <Price value={item.price} unit={item.unitLabel} />
            <View
              accessibilityElementsHidden importantForAccessibility="no"
              style={{ width: size.iconTileSm, height: size.iconTileSm, borderRadius: radius.pill, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="plus" size={size.iconSm} color={c.textOnBrand} strokeWidth={2.25} />
            </View>
          </View>
        </View>
      </View>
    </PressScale>
  );
}

/** Ikki ustunli setka (ScrollView ichida; FlatList'siz joylar uchun). */
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

/** Rasm/muqova ustidagi suzuvchi dumaloq tugma (orqaga). */
export function FloatingButton({ icon, label, onPress, style }: { icon: IconName; label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return <IconButton icon={icon} label={label} onPress={onPress} variant="secondary" tone="strong" style={style} />;
}

/**
 * Hajm tanlagich: − [qiymat] + . Qiymatni qo'lda ham yozish mumkin (masalan 12,5).
 * Tugmalar `min` dan pastga tushirmaydi.
 */
export function QtyStepper({ value, onChange, unit, min = 1, step = 1 }: { value: string; onChange: (v: string) => void; unit: string; min?: number; step?: number }) {
  const { c } = useTheme();
  const n = Number(value.replace(',', '.'));
  const cur = Number.isFinite(n) ? n : 0;
  const bump = (d: number) => {
    haptic.selection();
    onChange(String(Math.max(min, Math.round((cur + d) * 10) / 10)));
  };
  const btn = (icon: IconName, label: string, d: number, disabled?: boolean) => (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => bump(d)} hitSlop={space.xs}
      style={({ pressed }) => ({ width: size.touch, height: size.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} size={size.iconMd} tone="strong" strokeWidth={2} />
    </Pressable>
  );
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', height: size.buttonLg, borderRadius: radius.pill, backgroundColor: c.bgSurface, paddingHorizontal: space.xs }, shadow.card]}>
      {btn('minus', 'Kamaytirish', -step, cur <= min)}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs, minWidth: space.x12 + space.lg, justifyContent: 'center' }}>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          selectTextOnFocus
          accessibilityLabel={`Hajm, ${unit}`}
          style={[typeScale.titleSm, { color: c.textStrong, textAlign: 'right', minWidth: space.xl, padding: 0 }]}
        />
        <Txt v="caption">{unit}</Txt>
      </View>
      {btn('plus', "Ko'paytirish", step)}
    </View>
  );
}

/** Pastki suzuvchi panel qobig'i (StickyActionBar joylashuvi) — maxsus tarkib (stepper + jami) uchun. */
export function BottomBar({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.md) + space.xs, backgroundColor: c.bgApp, gap: space.sm, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }, shadow.pop]}>
      {children}
    </View>
  );
}
