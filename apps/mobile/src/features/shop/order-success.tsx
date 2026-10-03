import React from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Txt, fmtNum } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { Appear, stagger } from '@/design/motion';
import { SuccessCheck } from '@/design/success';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import type { ShopItem, ShopOrderResult } from './api';

export interface PlacedOrder { item: ShopItem; qty: number; total: number; address?: string; result: ShopOrderResult }

/**
 * Keyingi qadamlar — HAQIQIY jarayon: ariza ERP'ga tushadi, sotuv bo'limi qo'ng'iroq qilib
 * narx/yetkazishni kelishadi. Ilovada kuzatish hali yo'q, shuning uchun "jonli xarita" va'da qilinmaydi.
 */
const STEPS = [
  { title: 'Ariza qabul qilindi', sub: "ERP'da sotuv bo'limiga tushdi" },
  { title: "Sotuv bo'limi qo'ng'iroq qiladi", sub: 'Ish vaqtida — narx, marka va hajmni aniqlashtiradi' },
  { title: 'Yetkazish vaqti kelishiladi', sub: "Manzil, sana va to'lov usuli telefonda" },
  { title: 'Obyektga yetkaziladi', sub: "Qabul qilib, hujjatga imzo qo'yasiz" },
];

/**
 * "Buyurtma qabul qilindi" — mahsulot buyurtmasidan keyingi to'liq ekran (toast + orqaga o'rniga).
 * Raqam faqat server qaytarsa ko'rinadi.
 */
export function OrderSuccess({ order, phone, onDone }: { order: PlacedOrder; phone: string | null; onDone: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const no = order.result.number ?? order.result.id;
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.xxl, paddingHorizontal: space.pageX, paddingBottom: space.xxl, gap: space.section }}>
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <SuccessCheck size={size.avatarLg * 2} />
          <Txt v="titleLg" align="center" accessibilityRole="header">Buyurtma qabul qilindi</Txt>
          {no != null ? <Txt v="bodyStrong" color="brand" align="center">№ {String(no)}</Txt> : null}
          <Txt v="body" color="muted" align="center">{order.result.message || "Sotuv bo'limi tez orada siz bilan bog'lanadi"}</Txt>
        </View>

        <Appear delay={stagger(1)}>
          <Card style={{ gap: space.sm }}>
            <Txt v="overline">Buyurtma</Txt>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
              <Txt v="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>{order.item.name}</Txt>
              <Txt v="bodyStrong">{fmtNum(order.qty, order.qty % 1 ? 1 : 0)} {order.item.unitLabel}</Txt>
            </View>
            {order.address ? <Txt v="caption" numberOfLines={2}>{order.address}</Txt> : null}
            <View style={{ height: size.hairline, backgroundColor: c.borderSubtle }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Txt v="bodySm" color="muted">Taxminiy summa</Txt>
              <Txt v="titleSm">{fmtNum(order.total)} so&apos;m</Txt>
            </View>
            <Txt v="caption">Yakuniy narx va yetkazish narxini sotuv bo&apos;limi aytadi</Txt>
          </Card>
        </Appear>

        <Appear delay={stagger(2)}>
          <View style={{ gap: space.md }}>
            <Txt v="titleSm" accessibilityRole="header">Keyingi qadamlar</Txt>
            <Card style={{ gap: 0 }}>
              {STEPS.map((s, i) => {
                const done = i === 0;
                const last = i === STEPS.length - 1;
                return (
                  <View key={s.title} style={{ flexDirection: 'row', gap: space.md }}>
                    <View style={{ alignItems: 'center', width: size.iconLg }}>
                      <View style={{ width: size.iconLg, height: size.iconLg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? c.successSolid : c.bgMuted }}>
                        {done ? <Icon name="check" size={size.iconSm - 2} color={c.textOnSolid} strokeWidth={3} /> : <Txt v="caption" color="body">{i + 1}</Txt>}
                      </View>
                      {last ? null : <View style={{ flex: 1, width: size.ring, minHeight: space.lg, backgroundColor: done ? c.successSolid : c.borderDefault }} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: last ? 0 : space.lg }}>
                      <Txt v="bodyStrong" color={done ? 'strong' : 'body'}>{s.title}</Txt>
                      <Txt v="caption">{s.sub}</Txt>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        </Appear>
      </ScrollView>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: Math.max(insets.bottom, space.md) + space.xs, gap: space.sm }}>
        <Button title="Do'konga qaytish" size="lg" icon="store" onPress={onDone} />
        {phone ? <Button title="Sotuv bo'limiga qo'ng'iroq" variant="ghost" icon="phone" onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
      </View>
    </View>
  );
}
