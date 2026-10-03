import React from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Card, IconButton, IconTile, Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { PressScale } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space } from '@/design/tokens';
import type { ShopItem, ShopSeller } from './api';
import { useTodayStatus } from './today';
import { ProductArt } from './ui';

/**
 * Bosh sahifa: "Bugungi holat" — jonli nuqta, "Zavod ochiq · 18:00 gacha", ostida yetkazish
 * ("bugun yetkazamiz"), o'ngda dumaloq qo'ng'iroq / Telegram. Soatlar ERP Sozlamalardan;
 * bo'lmasa faqat aloqa tugmalari ko'rinadi.
 */
export function TodayCard({ seller, phone }: { seller?: ShopSeller; phone: string | null }) {
  const { c } = useTheme();
  const st = useTodayStatus(seller?.hours);
  const telegram = seller?.telegram ?? null;
  if (!st && !phone && !telegram) return null;

  return (
    <Card style={{ marginHorizontal: space.pageX, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
      {st ? (
        <View style={{ width: size.dot + space.sm, height: size.dot + space.sm, borderRadius: radius.pill, backgroundColor: st.open ? c.successBg : c.bgMuted, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: size.dot + 2, height: size.dot + 2, borderRadius: radius.pill, backgroundColor: st.open ? c.successSolid : c.textFaint }} />
        </View>
      ) : <IconTile icon="factory" module="brand" size={size.iconTileSm} />}
      <View style={{ flex: 1, minWidth: 0 }} accessible accessibilityLabel={st ? `${st.open ? 'Zavod ochiq' : 'Zavod yopiq'}, ${st.openLabel}. ${st.deliveryLabel}` : 'Zavod bilan bog\'lanish'}>
        <Txt v="bodyStrong" numberOfLines={1}>{st ? `${st.open ? 'Zavod ochiq' : 'Zavod yopiq'} · ${st.openLabel}` : 'Savolingiz bormi?'}</Txt>
        <Txt v="caption" color={st?.sameDay ? 'success' : 'muted'} numberOfLines={2}>{st ? st.deliveryLabel : "Sotuv bo'limi bilan bog'laning"}</Txt>
      </View>
      {telegram ? <IconButton icon="send" label="Telegram" variant="secondary" tone="brand" onPress={() => void Linking.openURL(telegram)} /> : null}
      {phone ? <IconButton icon="phone" label="Qo'ng'iroq qilish" variant="secondary" tone="brand" onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
    </Card>
  );
}

/** "Necha m³ kerak?" — kalkulyatorga kirish kartasi (yumshoq brend foni). */
export function CalcPromo({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Beton kalkulyatori: qancha beton kerakligini hisoblash"
      style={[{ marginHorizontal: space.pageX, borderRadius: radius.card, backgroundColor: c.brandSoft }, shadow.card]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.card }}>
        <IconTile icon="calculator" module="brand" style={{ backgroundColor: c.bgSurface }} />
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong">Necha m³ kerak?</Txt>
          <Txt v="caption" color="body">Poydevor o&apos;lchamini kiriting — hajm va narxni hisoblaymiz</Txt>
        </View>
        <Icon name="chevron-right" tone="brand" />
      </View>
    </PressScale>
  );
}

/** Toifa: nom + vitrinadagi birinchi mahsulot surati (bo'lmasa neytral belgi). */
export interface Category { name: string; photo: string | null; count: number }

/** Mahsulot guruhlari → toifalar (ERP'dagi guruh nomi bo'yicha, tartib saqlanadi). */
export function categoriesOf(items: ShopItem[]): Category[] {
  const map = new Map<string, Category>();
  for (const it of items) {
    if (!it.group) continue;
    const cur = map.get(it.group);
    if (cur) { cur.count += 1; if (!cur.photo && it.photo) cur.photo = it.photo; }
    else map.set(it.group, { name: it.group, photo: it.photo, count: 1 });
  }
  return Array.from(map.values());
}

/** Gorizontal toifa plitkalari — bosilsa katalog shu toifa bilan ochiladi. */
export function CategoryTiles({ items, onPick }: { items: Category[]; onPick: (name: string) => void }) {
  const { c } = useTheme();
  if (items.length < 2) return null;
  const tile = size.avatarLg + space.sm;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.pageX, gap: space.md, paddingVertical: space.xs }}>
      {items.map((g) => (
        <Pressable
          key={g.name} accessibilityRole="button" accessibilityLabel={`${g.name}, ${g.count} ta mahsulot`} onPress={() => onPick(g.name)}
          style={({ pressed }) => ({ alignItems: 'center', gap: space.xs, width: tile + space.sm, opacity: pressed ? 0.7 : 1 })}
        >
          <View style={[{ width: tile, height: tile, borderRadius: radius.card, backgroundColor: c.bgSurface, padding: space.xs }, shadow.card]}>
            <ProductArt photo={g.photo} ratio={1} iconSize={size.iconLg} style={{ borderRadius: radius.md }} />
          </View>
          <Txt v="caption" color="body" numberOfLines={1} align="center">{g.name}</Txt>
        </Pressable>
      ))}
    </ScrollView>
  );
}
