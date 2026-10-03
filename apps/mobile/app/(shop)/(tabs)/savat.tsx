import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, EmptyState, IconButton, KVList, Txt, fmtNum } from '@/design/primitives';
import { PageHeader, Reveal, StickyActionBar } from '@/design/blocks';
import { LiveItem, LiveList, haptic } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { cartTotal, useCart, type CartLine } from '@/features/shop/cart';
import { MiniArt, QtyStepper } from '@/features/shop/ui';

const parse = (s: string) => { const n = Number(s.replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };

/** Savat qatori: rasm, nom, narx birligi bilan, o'chirish; ostida hajm stepperi va qator summasi. */
function CartRow({ line }: { line: CartLine }) {
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const [text, setText] = useState(String(line.qty));
  // Savat boshqa joydan o'zgarsa (mahsulot sahifasidan qo'shilsa) — maydon yangilanadi
  useEffect(() => { if (parse(text) !== line.qty) setText(String(line.qty).replace('.', ',')); }, [line.qty]); // eslint-disable-line react-hooks/exhaustive-deps
  const onChange = (t: string) => { setText(t); const n = parse(t); if (n) setQty(line.productId, n); };
  return (
    <Card style={{ gap: space.md, padding: space.md + 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <MiniArt item={line} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="listTitle" numberOfLines={2}>{line.name}</Txt>
          <Txt v="tSm" numberOfLines={1}>{fmtNum(line.price)} so&apos;m/{line.unitLabel}</Txt>
        </View>
        <IconButton icon="trash" label={`${line.name} — savatdan olib tashlash`} tone="muted" onPress={() => { haptic.warning(); remove(line.productId); }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <QtyStepper compact value={text} onChange={onChange} unit={line.unitLabel} min={line.minQty ?? 1} />
        <Txt v="listValue" numberOfLines={1} style={{ flexShrink: 1 }}>{fmtNum(line.qty * line.price)} so&apos;m</Txt>
      </View>
    </Card>
  );
}

/**
 * Savat — demo tab paneli "Savat" (nishonda qatorlar soni). Savat faqat telefonda saqlanadi (MMKV);
 * "Rasmiylashtirish" — demo "Buyurtmani rasmiylashtirish" ekrani.
 */
export default function ShopCart() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const lines = useCart((s) => s.lines);
  const total = cartTotal(lines);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader overline={lines.length ? `${lines.length} ta mahsulot` : undefined} title="Savat" style={{ paddingTop: insets.top + space.sm }} />
      {lines.length ? (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xl }}>
            {/* Qatorlar birinchi ochilishda ketma-ket kiradi; o'chirilgan qator so'nadi, qolganlari (va jami) joyiga suriladi */}
            <LiveList stagger>
              <View style={{ gap: space.md }}>
                {lines.map((l, i) => <LiveItem key={l.productId} index={i}><CartRow line={l} /></LiveItem>)}
                <LiveItem key="sum" index={lines.length}>
                  <KVList rows={[
                    { label: 'Mahsulotlar', value: `${lines.length} ta` },
                    { label: 'Taxminiy jami', value: `${fmtNum(total)} so'm` },
                  ]} />
                </LiveItem>
                <LiveItem key="note" index={lines.length + 1}>
                  <Txt v="caption" align="center">Yetkazish narxini sotuv bo&apos;limi aniqlab aytadi</Txt>
                </LiveItem>
              </View>
            </LiveList>
          </ScrollView>
          <StickyActionBar primary={{ title: 'Rasmiylashtirish', icon: 'arrow-right', onPress: () => router.push('/(shop)/checkout' as never) }} />
        </>
      ) : (
        <Reveal style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="shopping-cart" title="Savat bo'sh"
            hint={'Katalogda mahsulot kartasidagi "+" tugmasi yoki mahsulot sahifasidagi "Savatga qo\'shish" bilan qo\'shing'}
            action="Katalogga o'tish" onAction={() => router.navigate('/(shop)/(tabs)/katalog' as never)}
          />
        </Reveal>
      )}
    </View>
  );
}
