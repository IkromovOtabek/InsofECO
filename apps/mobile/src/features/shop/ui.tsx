import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, IconTile, Txt, fmtNum } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space } from '@/design/tokens';
import { photoUrl, type ShopItem } from '@/features/shop/api';

const LOGO = require('../../../assets/logo.png') as number;
/** Kichik belgi (sotuvchi qatori uchun) — ilova ikonkasi. */
const LOGO_MARK = require('../../../assets/icon.png') as number;
/** Logotip nisbati (970×210) — balandlik beriladi, kenglik hisoblanadi. */
const LOGO_RATIO = 970 / 210;

/**
 * Do'kon sarlavhasi — faqat brend logotipi, tugmasiz. Kirish/kabinet «Profil» tabida:
 * mehmonni birinchi ekranda kirishga majburlamaymiz, u avval mahsulotni ko'rsin.
 */
export function ShopHeader({ children, height = 40 }: { children?: React.ReactNode; height?: number }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: c.bgChrome, borderBottomWidth: size.hairline, borderBottomColor: c.borderDefault, paddingTop: insets.top + space.md, paddingBottom: space.md, paddingHorizontal: space.pageX, gap: space.md }}>
      <Image source={LOGO} style={{ height, width: height * LOGO_RATIO, alignSelf: 'flex-start' }} resizeMode="contain" accessibilityLabel="Insof JBI — temir beton mahsulotlari" />
      {children}
    </View>
  );
}

/** Surat nisbati — vitrina suratlari 4:3 (800×600); boshqa nisbatda kesilib, yozuv yarim chiqardi. */
export const PHOTO_RATIO = 4 / 3;

/** Sotuvchi (zavod) qatori — kichik logotip + nom. Bosilsa zavod profili ochiladi. */
export function SellerChip({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Sotuvchi: ${name}`} onPress={onPress} hitSlop={6}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', paddingVertical: space.xs, opacity: pressed ? 0.6 : 1 })}>
      <Image source={LOGO_MARK} style={{ width: size.iconLg, height: size.iconLg, borderRadius: radius.pill }} resizeMode="cover" />
      <Txt v="caption" color="body" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Txt>
      <Icon name="chevron-right" tone="faint" size={size.iconSm} />
    </Pressable>
  );
}

/** Mahsulot kartasi — surat, yorliq, nom, sinf, narx, sotuvchi. `width` berilsa gorizontal ro'yxatda. */
export function ProductCard({ item, onPress, width, seller, onSeller }: { item: ShopItem; onPress: () => void; width?: number; seller?: string | null; onSeller?: () => void }) {
  const { c } = useTheme();
  const uri = photoUrl(item.photo);
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={item.name} onPress={onPress} android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [
        { flex: width ? undefined : 1, width, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: size.hairline, borderColor: c.borderDefault, overflow: 'hidden' },
        shadow.card, pressed && { backgroundColor: c.bgMuted },
      ]}
    >
      <View style={{ aspectRatio: PHOTO_RATIO, backgroundColor: c.bgMuted, alignItems: 'center', justifyContent: 'center' }}>
        {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors /> : <IconTile icon="package" module="brand" size={size.avatarLg} />}
        {item.badge ? <Badge label={item.badge} tone="brand" icon={null} style={{ position: 'absolute', top: space.sm, left: space.sm }} /> : null}
      </View>
      <View style={{ padding: space.md, gap: space.xs }}>
        <Txt v="bodyStrong" numberOfLines={2}>{item.name}</Txt>
        <Txt v="caption" numberOfLines={1}>{[item.code, item.strengthClass].filter(Boolean).join(' · ')}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs, marginTop: space.xs }}>
          <Txt v="titleSm" color="brand">{fmtNum(item.price)}</Txt>
          <Txt v="caption">so'm / {item.unitLabel}</Txt>
        </View>
        {seller && onSeller ? <SellerChip name={seller} onPress={onSeller} /> : null}
      </View>
    </Pressable>
  );
}
