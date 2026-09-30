import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Button, Card, IconTile, Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import type { ShopSeller } from './api';
import { useTodayStatus } from './today';

/**
 * Bosh sahifa: "Bugungi holat" — hozir ochiqmi, bugun yetkazamizmi, va tezkor aloqa
 * (qo'ng'iroq, Telegram). Mijoz birinchi bo'lib "bugun olib kelasizmi?" deb so'raydi —
 * javob ekranning o'zida turadi. Soatlar ERP Sozlamalardan; bo'lmasa faqat aloqa tugmalari.
 */
export function TodayCard({ seller, phone }: { seller?: ShopSeller; phone: string | null }) {
  const { c } = useTheme();
  const st = useTodayStatus(seller?.hours);
  const telegram = seller?.telegram ?? null;
  if (!st && !phone && !telegram) return null;

  return (
    <Card style={{ marginHorizontal: space.pageX, borderRadius: radius.card, gap: space.md }}>
      {st ? (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {/* Jonli nuqta — ochiq bo'lsa yashil */}
            <View style={{ width: size.dot, height: size.dot, borderRadius: radius.pill, backgroundColor: st.open ? c.successSolid : c.textFaint }} />
            <Txt v="bodyStrong">{st.open ? 'Hozir ochiq' : 'Hozir yopiq'}</Txt>
            <Txt v="bodySm" color="muted">· {st.openLabel}</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: st.sameDay ? c.successBg : c.bgMuted }}>
            <Icon name="truck" size={size.iconSm} tone={st.sameDay ? 'success' : 'muted'} />
            <Txt v="bodySm" color={st.sameDay ? 'success' : 'body'} style={{ flex: 1 }}>{st.deliveryLabel}</Txt>
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {/* Button o'z o'ramiga style bermaydi — teng enlik uchun har biri flex:1 qutida */}
        {phone ? <View style={{ flex: 1 }}><Button title="Qo'ng'iroq" icon="phone" variant={telegram ? 'secondary' : 'primary'} onPress={() => void Linking.openURL(`tel:${phone}`)} /></View> : null}
        {telegram ? <View style={{ flex: 1 }}><Button title="Telegram" icon="send" onPress={() => void Linking.openURL(telegram)} /></View> : null}
      </View>
    </Card>
  );
}

/** "Qancha beton kerak?" — kalkulyatorga kirish kartasi. */
export function CalcPromo({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Beton kalkulyatori: qancha beton kerakligini hisoblash"
      style={({ pressed }) => ({ marginHorizontal: space.pageX, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.card, borderRadius: radius.card, backgroundColor: c.brandSoft, borderWidth: size.hairline, borderColor: c.brandRing, opacity: pressed ? 0.85 : 1 })}
    >
      <IconTile icon="calculator" module="brand" />
      <View style={{ flex: 1 }}>
        <Txt v="bodyStrong">Qancha beton kerak?</Txt>
        <Txt v="caption">O&apos;lchamlarni kiriting — hajm va narxni darhol hisoblaymiz</Txt>
      </View>
      <Icon name="chevron-right" tone="brand" />
    </Pressable>
  );
}
