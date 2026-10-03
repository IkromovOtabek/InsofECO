import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, IconButton, Timeline, Txt, fmtNum, fmtTime } from '@/design/primitives';
import { Reveal } from '@/design/blocks';
import { SuccessCheck } from '@/design/success';
import { copyText } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import type { SentOrder } from './cart';

/**
 * "Buyurtma qabul qilindi" — demo ekran 25: katta ptichka, sarlavha, raqam (faqat server qaytarsa) + nusxa,
 * buyurtma kartasi (mahsulot · hajm, vaqt · manzil, taxminiy summa) va HAQIQIY keyingi qadamlar:
 * ariza ERP'ga tushdi → sotuv bo'limi qo'ng'iroq qiladi → yetkazish tasdiqdan so'ng. Soxta kuzatish yo'q.
 */
export function OrderSuccess({ orders, onOrders, onDone }: { orders: SentOrder[]; onOrders: () => void; onDone: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const first = orders[0];
  if (!first) return null;
  const numbers = orders.map((o) => o.number).filter((x): x is string => !!x);
  const total = orders.reduce((a, o) => a + o.total, 0);
  const q = (o: SentOrder) => `${fmtNum(o.line.qty, o.line.qty % 1 ? 1 : 0)} ${o.line.unitLabel}`;
  const title = orders.length > 1 ? `${first.line.name} · ${q(first)} va yana ${orders.length - 1} ta` : `${first.line.name} · ${q(first)}`;
  const sub = [first.when, first.address].filter(Boolean).join(' · ');
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.xxxl, paddingHorizontal: space.pageX, paddingBottom: space.xxl }}>
        <Reveal gap={space.lg}>
          <View style={{ alignItems: 'center', gap: space.md }}>
            <SuccessCheck size={size.avatarLg * 2} />
            <Txt v="titleLg" align="center" accessibilityRole="header">Buyurtma qabul qilindi</Txt>
            {numbers.length ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <Txt v="body" color="muted">№ {numbers.join(', ')}</Txt>
                <IconButton icon="copy" label="Raqamni nusxalash" tone="muted" size={size.iconTileSm} onPress={() => void copyText(numbers.join(', '))} />
              </View>
            ) : <Txt v="body" color="muted" align="center">{first.message || "Sotuv bo'limi tez orada siz bilan bog'lanadi"}</Txt>}
          </View>

          <Card style={{ gap: space.sm }}>
            <Txt v="listTitle" numberOfLines={2}>{title}</Txt>
            {sub ? <Txt v="tSm" numberOfLines={2}>{sub}</Txt> : null}
            <Txt v="titleLg" style={{ marginTop: space.xs }}>≈ {fmtNum(total)} so&apos;m</Txt>
          </Card>

          <Card>
            <Timeline
              steps={[
                { title: 'Qabul qilindi', sub: fmtTime(first.at), state: 'done' },
                { title: "Sotuv bo'limi qo'ng'iroq qiladi", sub: 'Ish vaqtida — narx va vaqtni aniqlashtiradi', state: 'now' },
                { title: 'Yetkazish: tasdiqdan so\'ng', state: 'todo' },
              ]}
            />
          </Card>
        </Reveal>
      </ScrollView>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: Math.max(insets.bottom, space.lg) + space.xs, gap: space.sm }}>
        <Button title="Buyurtmalarim" size="sticky" onPress={onOrders} />
        <Button title="Do'konga qaytish" variant="secondary" size="sticky" onPress={onDone} />
      </View>
    </View>
  );
}
