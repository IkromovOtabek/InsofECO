import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, EmptyState, Input, ListItem, Txt, fmtNum } from '@/design/primitives';
import { ChipGroup, ListGroup, PageHeader, Reveal, StickyActionBar } from '@/design/blocks';
import { Icon, type IconName } from '@/design/icons';
import { haptic } from '@/design/motion';
import { Sheet, fmtShort, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { elevation, radius, size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { afterLogin } from '@/features/shop/after-login';
import { cartTotal, useCart, type SentOrder } from '@/features/shop/cart';
import { submitCart } from '@/features/shop/orders';
import { OrderSuccess } from '@/features/shop/order-success';
import { MiniArt } from '@/features/shop/ui';

const PAYS: { key: string; label: string; icon: IconName }[] = [
  { key: 'Naqd', label: 'Naqd', icon: 'banknote' },
  { key: 'Click', label: 'Click', icon: 'wallet' },
  { key: 'Payme', label: 'Payme', icon: 'wallet' },
  { key: "Bank o'tkazma", label: "Bank o'tkazma", icon: 'receipt' },
];
const DAYS = ['Bugun', 'Ertaga', 'Indinga'] as const;
type Day = (typeof DAYS)[number];
const SLOTS = ['08:00–10:00', '10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00'];

const mln = (n: number) => fmtShort(n).replace('.', ',');

/** Demo `.pay`: 52 dp yuza tugma (sh1), tanlangani — brend chegara, brandSoft fon, brandInk matn. */
function PayOption({ label, icon, on, onPress }: { label: string; icon: IconName; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}
      onPress={() => { haptic.selection(); onPress(); }}
      style={({ pressed }) => [{ flex: 1, height: size.buttonLg, borderRadius: radius.md + 2, borderCurve: 'continuous', borderWidth: size.ring, borderColor: on ? c.brand : 'transparent', backgroundColor: on ? c.brandSoft : c.bgSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, opacity: pressed ? 0.8 : 1 }, elevation(c).sh1]}
    >
      <Icon name={icon} size={size.iconMd - 1} tone={on ? 'brand' : 'strong'} strokeWidth={1.75} />
      <Txt v="bodyStrong" style={{ color: on ? c.brandInk : c.textStrong }} numberOfLines={1}>{label}</Txt>
    </Pressable>
  );
}

/**
 * Buyurtmani rasmiylashtirish — demo CLIENT[4]: savatdagi mahsulotlar, YETKAZISH (manzil, vaqt, aloqa),
 * TO'LOV (afzal usul), jami va "Buyurtmani tasdiqlash". Har savat qatori alohida mavjud
 * `ShopOrderInput` bo'lib ketma-ket yuboriladi; vaqt va to'lov usuli izohga yoziladi (ERP'da alohida maydon yo'q).
 * Yetkazish narxi va chegirma API'da yo'q — ko'rsatilmaydi, sotuv bo'limi aytadi.
 */
export default function Checkout() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const lines = useCart((s) => s.lines);
  const contact = useCart((s) => s.contact);
  const setContact = useCart((s) => s.setContact);
  const markSent = useCart((s) => s.markSent);
  const authed = useSession((s) => s.status === 'authed');
  const sessionName = useSession((s) => (s.kind === 'erp' ? s.erp?.fullName : s.user?.fullName) ?? '');
  const sessionPhone = useSession((s) => s.user?.phone ?? '');

  const [name, setName] = useState(contact.name || sessionName);
  const [phone, setPhone] = useState(contact.phone || sessionPhone);
  const [address, setAddress] = useState(contact.address);
  const [day, setDay] = useState<Day>('Ertaga');
  const [slot, setSlot] = useState<string | null>(null);
  const [pay, setPay] = useState<string>('Naqd');
  const [sheet, setSheet] = useState<null | 'address' | 'time' | 'contact'>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [placed, setPlaced] = useState<SentOrder[] | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(shop)/(tabs)/savat' as never));

  if (placed) {
    return <OrderSuccess orders={placed} onOrders={() => router.dismissTo('/(shop)/(tabs)/buyurtma' as never)} onDone={() => router.dismissTo('/(shop)' as never)} />;
  }

  const total = cartTotal(lines);
  const when = slot ? `${day}, ${slot}` : null;
  const digits = phone.replace(/\D/g, '');
  const phoneOk = digits.length === 9 || digits.length === 12;
  const nameOk = name.trim().length >= 2;

  const submit = async () => {
    if (!authed) {
      afterLogin.set('/(shop)/checkout');
      router.push('/(auth)/login');
      return;
    }
    if (!address.trim()) { haptic.warning(); toast.warning('Obyekt manzilini kiriting'); setSheet('address'); return; }
    if (!nameOk || !phoneOk) { haptic.warning(); toast.warning(!nameOk ? 'Ismingizni yozing' : 'Telefon: 90 123 45 67'); setSheet('contact'); return; }
    setContact({ name: name.trim(), phone: phone.trim(), address: address.trim() });
    const note = [when ? `Yetkazish vaqti: ${when}` : null, `To'lov: ${pay}`].filter(Boolean).join('. ');
    setSending(0);
    const out = await submitCart(lines, { name: name.trim(), phone: phone.trim(), address: address.trim(), note }, (n) => setSending(n));
    setSending(null);
    const rows = out.done.length ? markSent(out.done, { address: address.trim(), when: when ?? undefined, pay }) : [];
    const notSent = out.failed.length + out.skipped.length;
    if (!out.done.length) {
      haptic.error();
      toast.error(`${out.failed[0]?.error ?? 'Xato'} — savat saqlandi, qayta urinib ko'ring`, 'Buyurtma yuborilmadi');
      return;
    }
    if (notSent) toast.warning(`${out.done.length} tasi yuborildi, ${notSent} tasi yuborilmadi (${out.failed[0]?.error ?? 'xato'}). Ular savatda qoldi.`, 'Qisman yuborildi');
    haptic.success();
    setPlaced(rows);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title="Buyurtma" onBack={back} right={lines.length ? <Txt v="tSm" color="body" style={{ marginRight: space.sm }}>{lines.length} ta</Txt> : undefined} style={{ paddingTop: insets.top + space.sm }} />
      {!lines.length ? (
        <EmptyState icon="shopping-cart" title="Savat bo'sh" hint="Avval mahsulot qo'shing" action="Katalogga o'tish" onAction={() => router.dismissTo('/(shop)/(tabs)/katalog' as never)} style={{ flex: 1, justifyContent: 'center' }} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
            <Reveal gap={space.md + 2}>
              <ListGroup>
                {lines.map((l) => (
                  <ListItem
                    key={l.productId} leading={<MiniArt item={l} />} title={l.name}
                    subtitle={`${fmtNum(l.qty, l.qty % 1 ? 1 : 0)} ${l.unitLabel} · ${fmtNum(l.price)} so'm/${l.unitLabel}`} subtitleLines={1}
                    value={mln(l.qty * l.price)}
                  />
                ))}
              </ListGroup>

              <Txt v="overline">Yetkazish</Txt>
              <ListGroup>
                <ListItem icon="map" module="logistics" title={address.trim() || 'Obyekt manzilini kiriting'} subtitle="Obyekt manzili" onPress={() => setSheet('address')} chevron />
                <ListItem icon="calendar-days" module="production" title={when ?? 'Vaqtni tanlang'} subtitle={when ? 'Afzal vaqt — sotuv bo\'limi tasdiqlaydi' : 'Ixtiyoriy — telefonda kelishiladi'} onPress={() => setSheet('time')} chevron />
                <ListItem icon="user" module="brand" title={nameOk ? name.trim() : 'Ism va telefon'} subtitle={phoneOk ? phone.trim() : "Sotuv bo'limi shu raqamga qo'ng'iroq qiladi"} onPress={() => setSheet('contact')} chevron />
              </ListGroup>

              <Txt v="overline">To&apos;lov</Txt>
              <View style={{ gap: space.tight }}>
                {[0, 1].map((r) => (
                  <View key={r} style={{ flexDirection: 'row', gap: space.tight }}>
                    {PAYS.slice(r * 2, r * 2 + 2).map((p) => <PayOption key={p.key} label={p.label} icon={p.icon} on={pay === p.key} onPress={() => setPay(p.key)} />)}
                  </View>
                ))}
                <Txt v="caption">To&apos;lov ilovada olinmaydi — tanlangan usulni sotuv bo&apos;limi tasdiqlaydi</Txt>
              </View>

              <Card style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
                  <Txt v="kv">Mahsulotlar</Txt>
                  <Txt v="kv" color="strong">{fmtNum(total)}</Txt>
                </View>
                <View style={{ height: size.hairline, backgroundColor: c.borderSubtle }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md }}>
                  <Txt v="listTitle">Jami (taxminiy)</Txt>
                  <Txt v="listTitle">{fmtNum(total)} so&apos;m</Txt>
                </View>
                <Txt v="caption">Yetkazish narxi va chegirmani sotuv bo&apos;limi aytadi</Txt>
              </Card>
            </Reveal>
          </ScrollView>
          <StickyActionBar
            primary={{
              title: sending != null ? `Yuborilmoqda… ${sending}/${lines.length}` : authed ? 'Buyurtmani tasdiqlash' : 'Kirib tasdiqlash',
              icon: authed ? undefined : 'log-in',
              loading: sending != null,
              onPress: () => void submit(),
            }}
          />
        </>
      )}

      <Sheet open={sheet === 'address'} onClose={() => setSheet(null)} title="Obyekt manzili" footer={<Button title="Saqlash" size="lg" onPress={() => setSheet(null)} />}>
        <Input label="Manzil" value={address} onChangeText={setAddress} placeholder="Shahar, ko'cha, uy, mo'ljal" left="map-pin" autoFocus multiline containerStyle={{ marginBottom: 0 }} />
      </Sheet>

      <Sheet open={sheet === 'time'} onClose={() => setSheet(null)} title="Yetkazish vaqti" footer={<Button title="Tayyor" size="lg" onPress={() => setSheet(null)} />}>
        <View style={{ gap: space.lg }}>
          <ChipGroup<Day> items={DAYS.map((d) => ({ key: d, label: d }))} value={day} onChange={setDay} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {SLOTS.map((s) => (
              <Button key={s} title={s} full={false} variant={slot === s ? 'primary' : 'secondary'} onPress={() => setSlot(slot === s ? null : s)} />
            ))}
          </View>
          <Txt v="caption">Bu — afzal vaqt. Aniq vaqtni sotuv bo&apos;limi mikserlar navbatiga qarab tasdiqlaydi.</Txt>
        </View>
      </Sheet>

      <Sheet open={sheet === 'contact'} onClose={() => setSheet(null)} title="Aloqa" footer={<Button title="Saqlash" size="lg" onPress={() => setSheet(null)} />}>
        <Input label="Ismingiz" required value={name} onChangeText={setName} placeholder="Ism familiya" left="user" autoCapitalize="words" error={name && !nameOk ? 'Ismingizni yozing' : undefined} />
        <Input label="Telefon" required value={phone} onChangeText={setPhone} placeholder="90 123 45 67" keyboardType="phone-pad" left="phone" mono error={phone && !phoneOk ? 'Telefon: 90 123 45 67' : undefined} containerStyle={{ marginBottom: 0 }} />
      </Sheet>
    </View>
  );
}
