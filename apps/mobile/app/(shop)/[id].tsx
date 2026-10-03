import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Callout, Card, EmptyState, IconTile, Input, ListItem, Skeleton, Txt, fmtNum } from '@/design/primitives';
import { ChipGroup, ListGroup } from '@/design/blocks';
import { Appear, haptic, stagger } from '@/design/motion';
import { toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { useShopCatalog, useShopOrder } from '@/features/shop/api';
import { BottomBar, FloatingButton, PHOTO_RATIO, Price, ProductArt, QtyStepper, SellerChip } from '@/features/shop/ui';
import { OrderSuccess, type PlacedOrder } from '@/features/shop/order-success';
import { useTodayStatus } from '@/features/shop/today';
import { afterLogin } from '@/features/shop/after-login';

/**
 * Mahsulot sahifasi: katta surat, marka (shu guruhdagi boshqa mahsulotlar), texnik ko'rsatkichlar,
 * yetkazish va buyurtma tafsilotlari. Pastda doim ko'rinadigan panel: hajm stepperi + jami + "Buyurtma".
 * Buyurtma faqat kirgan foydalanuvchidan: mehmon bossa login ochiladi va kirgach shu sahifaga qaytadi.
 * Savat yo'q — bitta so'rov bitta mahsulot (ShopOrderInput); muvaffaqiyatdan keyin to'liq ekran.
 */
export default function ShopProduct() {
  // `qty` — kalkulyatordan kelsa hajm tayyor to'ldiriladi
  const { id, qty: qtyParam } = useLocalSearchParams<{ id: string; qty?: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const q = useShopCatalog();
  const item = q.data?.items.find((i) => i.id === id);
  const user = useSession((s) => s.user);
  const authed = useSession((s) => s.status === 'authed');
  const order = useShopOrder();
  const today = useTodayStatus(q.data?.seller?.hours);

  const [qty, setQty] = useState(() => qtyParam ?? String(item?.minQty ?? 1));
  const [name, setName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  // Login'dan qaytganda sahifa o'sha-o'sha (qayta ochilmaydi) — ism/telefonni shu yerda to'ldiramiz
  useEffect(() => {
    if (!user) return;
    setName((v) => v || (user.fullName ?? ''));
    setPhone((v) => v || user.phone);
  }, [user]);

  // Katalog kechroq yuklansa — eng kam hajmni qo'yamiz (kalkulyator hajmi ustun)
  useEffect(() => {
    if (!qtyParam && item?.minQty) setQty((v) => (Number(v.replace(',', '.')) < item.minQty! ? String(item.minQty) : v));
  }, [item?.minQty, qtyParam]);

  // Marka — shu guruhdagi boshqa mahsulotlar (masalan M200…M400)
  const siblings = useMemo(
    () => (item?.group ? (q.data?.items ?? []).filter((i) => i.group === item.group) : []),
    [q.data, item?.group],
  );

  const companyPhone = q.data?.seller?.phone ?? q.data?.company.phone ?? null;

  if (placed) return <OrderSuccess order={placed} phone={companyPhone} onDone={() => router.dismissTo('/(shop)' as never)} />;

  const back = (
    <FloatingButton icon="arrow-left" label="Orqaga" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(shop)' as never))} style={{ position: 'absolute', top: insets.top + space.sm, left: space.pageX }} />
  );

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <Skeleton height={Math.round(width / PHOTO_RATIO)} width="100%" radius={0} />
        <View style={{ padding: space.pageX, gap: space.md }}>
          <Skeleton width="40%" height={space.md} />
          <Skeleton width="80%" height={space.xxl} />
          <Skeleton width="50%" height={space.xxl} />
          <Skeleton height={size.driverTouch * 2} radius={radius.card} />
        </View>
        {back}
      </View>
    );
  }
  if (!item) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp, justifyContent: 'center' }}>
        {q.error
          ? <EmptyState icon="circle-alert" title="Mahsulot yuklanmadi" hint="Internetni tekshiring" onRetry={() => void q.refetch()} />
          : <EmptyState icon="package" title="Mahsulot topilmadi" hint="Do'kondan olib tashlangan bo'lishi mumkin" action="Do'konga qaytish" onAction={() => router.dismissTo('/(shop)' as never)} />}
        {back}
      </View>
    );
  }

  const n = Number(qty.replace(',', '.'));
  const valid = Number.isFinite(n) && n > 0;
  const total = valid ? n * item.price : 0;
  const seller = q.data?.seller?.name ?? q.data?.company.name ?? '';
  const markLabel = (i: typeof item) => i.strengthClass ?? i.code ?? i.name;

  const specs = [
    item.code ? { label: 'Kod', value: item.code } : null,
    item.strengthClass ? { label: 'Mustahkamlik sinfi', value: item.strengthClass } : null,
    item.group ? { label: 'Toifa', value: item.group } : null,
    { label: "O'lchov birligi", value: item.unitLabel },
    item.minQty ? { label: 'Eng kam buyurtma', value: `${fmtNum(item.minQty)} ${item.unitLabel}` } : null,
  ].filter((x): x is { label: string; value: string } => !!x);

  const submit = () => {
    if (!authed) {
      afterLogin.set(`/(shop)/${item.id}`);
      router.push('/(auth)/login');
      return;
    }
    const e: Record<string, string> = {};
    if (!valid) e.qty = 'Hajmni kiriting';
    else if (item.minQty && n < item.minQty) e.qty = `Eng kam buyurtma: ${fmtNum(item.minQty)} ${item.unitLabel}`;
    if (name.trim().length < 2) e.name = 'Ismingizni yozing';
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 9 && digits.length !== 12) e.phone = 'Telefon: 90 123 45 67';
    setErrors(e);
    if (Object.keys(e).length) {
      haptic.warning();
      toast.warning(e.qty ?? e.name ?? e.phone ?? "Ma'lumotlarni tekshiring");
      return;
    }
    order.mutate(
      { productId: item.id, qty: n, name: name.trim(), phone: phone.trim(), address: address.trim() || undefined, note: note.trim() || undefined },
      {
        onSuccess: (r) => { haptic.success(); setPlaced({ item, qty: n, total, address: address.trim() || undefined, result: r }); },
        onError: (err) => toast.error(err instanceof ApiException ? err.message : 'Tarmoq xatosi — internetni tekshiring', 'Yuborilmadi'),
      },
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <ProductArt photo={item.photo} ratio={PHOTO_RATIO} iconSize={size.avatarLg} />

        <View style={{ marginTop: -space.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: c.bgApp, paddingHorizontal: space.pageX, paddingTop: space.xl, gap: space.lg }}>
          <Appear>
            <View style={{ gap: space.xs }}>
              <SellerChip name={seller} onPress={() => router.push('/(shop)/zavod' as never)} />
              <Txt v="titleLg" accessibilityRole="header">{item.name}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                <Price value={item.price} unit={item.unitLabel} big />
                {item.badge ? <Badge label={item.badge} tone="brand" icon={null} /> : null}
                {today?.sameDay ? <Badge label="Bugun yetkazamiz" tone="success" /> : null}
              </View>
            </View>
          </Appear>

          {siblings.length > 1 ? (
            <Appear delay={stagger(1)} style={{ gap: space.sm }}>
              <Txt v="overline">Marka</Txt>
              <ChipGroup items={siblings.map((s) => ({ key: s.id, label: markLabel(s) }))} value={item.id} onChange={(k) => router.setParams({ id: k })} />
            </Appear>
          ) : null}

          {item.description ? <Txt v="body" color="body">{item.description}</Txt> : null}

          <Appear delay={stagger(2)}>
            <ListGroup>
              {specs.map((s) => (
                <ListItem key={s.label} title={s.label} right={<Txt v="bodyStrong">{s.value}</Txt>} />
              ))}
            </ListGroup>
          </Appear>

          <Appear delay={stagger(3)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <IconTile icon="truck" module="logistics" />
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">{item.unit === 'm3' ? 'Mikser bilan yetkazish' : "O'z transportimiz bilan yetkazish"}</Txt>
                <Txt v="caption">{today ? today.deliveryLabel : "Yetkazish vaqti va narxini sotuv bo'limi kelishadi"}</Txt>
              </View>
            </Card>
          </Appear>

          <Appear delay={stagger(4)} style={{ gap: space.sm }}>
            <Txt v="titleSm" accessibilityRole="header">Buyurtma tafsilotlari</Txt>
            <Card>
              {authed ? (
                <>
                  <Input label="Ismingiz" required value={name} onChangeText={(v) => { setName(v); setErrors((x) => ({ ...x, name: '' })); }} placeholder="Ism familiya" left="user" error={errors.name || undefined} autoCapitalize="words" />
                  <Input label="Telefon" required value={phone} onChangeText={(v) => { setPhone(v); setErrors((x) => ({ ...x, phone: '' })); }} placeholder="90 123 45 67" keyboardType="phone-pad" left="phone" mono error={errors.phone || undefined} hint="Sotuv bo'limi shu raqamga qo'ng'iroq qiladi" />
                </>
              ) : null}
              <Input label="Obyekt manzili" value={address} onChangeText={setAddress} placeholder="Shahar, ko'cha, mo'ljal" left="map-pin" />
              <Input label="Izoh" value={note} onChangeText={setNote} placeholder="Qachon kerak, nasos kerakmi…" multiline numberOfLines={3} containerStyle={{ marginBottom: 0 }} style={{ minHeight: size.input + space.xxl, paddingTop: space.sm }} />
            </Card>
            {errors.qty ? <Callout tone="danger">{errors.qty}</Callout> : null}
            {item.minQty ? <Callout tone="info">{`Eng kam buyurtma: ${fmtNum(item.minQty)} ${item.unitLabel}`}</Callout> : null}
            {authed ? null : <Callout tone="info">Buyurtma berish uchun hisobingizga kiring — Telegram orqali bir daqiqa oladi. Kiritganlaringiz saqlanib qoladi.</Callout>}
            <Txt v="caption" align="center">Narx taxminiy — yetkazish va hajmga qarab sotuv bo&apos;limi aniqlaydi</Txt>
          </Appear>
        </View>
      </ScrollView>

      <BottomBar>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Txt v="caption">Taxminiy jami</Txt>
          <Txt v="titleSm" accessibilityLiveRegion="polite">{total ? `${fmtNum(total)} so'm` : '—'}</Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <QtyStepper value={qty} onChange={(v) => { setQty(v); setErrors((x) => ({ ...x, qty: '' })); }} unit={item.unitLabel} min={item.minQty ?? 1} />
          <View style={{ flex: 1 }}>
            <Button title={authed ? 'Buyurtma berish' : 'Kirib buyurtma'} size="lg" icon={authed ? 'shopping-cart' : 'log-in'} loading={order.isPending} onPress={submit} />
          </View>
        </View>
      </BottomBar>
      {back}
    </KeyboardAvoidingView>
  );
}
