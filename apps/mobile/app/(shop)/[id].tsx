import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Callout, Card, Divider, EmptyState, Gap, IconTile, Input, Txt, fmtNum } from '@/design/primitives';
import { toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { photoUrl, useShopCatalog, useShopOrder } from '@/features/shop/api';

/**
 * Mahsulot kartochkasi + buyurtma formasi. Mehmon ham buyurtma bera oladi — ism va telefon
 * so'raladi; kirgan mijozniki sessiyadan to'ldiriladi. Buyurtma ERP'ga ariza bo'lib tushadi,
 * sotuv bo'limi qo'ng'iroq qiladi.
 */
export default function ShopProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useShopCatalog();
  const item = q.data?.items.find((i) => i.id === id);
  const user = useSession((s) => s.user);
  const order = useShopOrder();

  const [qty, setQty] = useState(() => String(item?.minQty ?? 1));
  const [name, setName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (q.isLoading) return null;
  if (!item) return <EmptyState icon="package" title="Mahsulot topilmadi" hint="Do'kondan olib tashlangan bo'lishi mumkin" action="Do'konga qaytish" onAction={() => router.back()} />;

  const n = Number(qty.replace(',', '.'));
  const total = Number.isFinite(n) && n > 0 ? n * item.price : 0;
  const uri = photoUrl(item.photo);

  const submit = () => {
    const e: Record<string, string> = {};
    if (!Number.isFinite(n) || n <= 0) e.qty = 'Hajmni kiriting';
    else if (item.minQty && n < item.minQty) e.qty = `Eng kam buyurtma: ${fmtNum(item.minQty)} ${item.unitLabel}`;
    if (name.trim().length < 2) e.name = 'Ismingizni yozing';
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 9 && digits.length !== 12) e.phone = 'Telefon: 90 123 45 67';
    setErrors(e);
    if (Object.keys(e).length) return;
    order.mutate(
      { productId: item.id, qty: n, name: name.trim(), phone: phone.trim(), address: address.trim() || undefined, note: note.trim() || undefined },
      {
        onSuccess: (r) => { toast.success(r.message, 'Qabul qilindi'); router.back(); },
        onError: (err) => toast.error(err instanceof ApiException ? err.message : 'Tarmoq xatosi — internetni tekshiring', 'Yuborilmadi'),
      },
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }} keyboardShouldPersistTaps="handled">
        <View style={{ aspectRatio: 4 / 3, backgroundColor: c.bgMuted, alignItems: 'center', justifyContent: 'center' }}>
          {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors /> : <IconTile icon="package" module="brand" size={size.avatarLg + space.lg} />}
          {item.badge ? <Badge label={item.badge} tone="brand" icon={null} style={{ position: 'absolute', top: space.md, left: space.pageX }} /> : null}
        </View>

        <View style={{ paddingHorizontal: space.pageX, paddingTop: space.lg, gap: space.md }}>
          <View>
            <Txt v="caption">{[item.group, item.code, item.strengthClass].filter(Boolean).join(' · ')}</Txt>
            <Txt v="titleLg">{item.name}</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
            <Txt v="metric" color="brand">{fmtNum(item.price)}</Txt>
            <Txt v="body" color="muted">so'm / {item.unitLabel}</Txt>
          </View>
          {item.description ? <Txt v="body" color="body">{item.description}</Txt> : null}
          {item.minQty ? <Callout tone="info">{`Eng kam buyurtma: ${fmtNum(item.minQty)} ${item.unitLabel}`}</Callout> : null}

          <Card style={{ marginTop: space.sm, borderRadius: radius.card }}>
            <Txt v="titleSm" style={{ marginBottom: space.md }}>Buyurtma berish</Txt>
            <Input label={`Hajm, ${item.unitLabel}`} required value={qty} onChangeText={setQty} keyboardType="decimal-pad" mono error={errors.qty} />
            <Input label="Ismingiz" required value={name} onChangeText={setName} placeholder="Ism familiya" left="user" error={errors.name} autoCapitalize="words" />
            <Input label="Telefon" required value={phone} onChangeText={setPhone} placeholder="90 123 45 67" keyboardType="phone-pad" left="phone" mono error={errors.phone} hint="Sotuv bo'limi shu raqamga qo'ng'iroq qiladi" />
            <Input label="Obyekt manzili" value={address} onChangeText={setAddress} placeholder="Shahar, ko'cha, mo'ljal" left="map-pin" />
            <Input label="Izoh" value={note} onChangeText={setNote} placeholder="Qachon kerak, nasos kerakmi…" multiline numberOfLines={3} style={{ minHeight: size.input + space.xxl, paddingTop: space.sm }} />
            <Divider style={{ marginBottom: space.md }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.md }}>
              <Txt v="bodySm" color="muted">Taxminiy summa</Txt>
              <Txt v="titleMd">{total ? `${fmtNum(total)} so'm` : '—'}</Txt>
            </View>
            <Button title="Buyurtma berish" size="lg" icon="shopping-cart" loading={order.isPending} onPress={submit} />
            <Gap h={space.sm} />
            <Txt v="caption" align="center">Narx taxminiy — yetkazish va hajmga qarab sotuv bo'limi aniqlaydi</Txt>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
