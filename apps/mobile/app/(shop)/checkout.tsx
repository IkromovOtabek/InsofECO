import React, { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, EmptyState, Input, ListItem, Txt, fmtNum } from '@/design/primitives';
import { AddressPicker, type AddressValue } from '@/features/address/AddressPicker';
import { DayStrip, addDays, dayLabelLong, startOfToday, tashkentHour, ymd } from '@/features/address/DayStrip';
import { ListGroup, PageHeader, Reveal, StickyActionBar } from '@/design/blocks';
import { Icon, type IconName } from '@/design/icons';
import { PressScale, haptic } from '@/design/motion';
import { Sheet, fmtShort, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { elevation, radius, size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { afterLogin } from '@/features/shop/after-login';
import { cartTotal, useCart, type SentOrder } from '@/features/shop/cart';
import { orderAttemptKey, submitCart } from '@/features/shop/orders';
import { OrderSuccess } from '@/features/shop/order-success';
import { MiniArt } from '@/features/shop/ui';

const PAYS: { key: string; label: string; icon: IconName }[] = [
  { key: 'Naqd', label: 'Naqd', icon: 'banknote' },
  { key: 'Click', label: 'Click', icon: 'wallet' },
  { key: 'Payme', label: 'Payme', icon: 'wallet' },
  { key: "Bank o'tkazma", label: "Bank o'tkazma", icon: 'receipt' },
];
const SLOTS = ['08:00–10:00', '10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00'];
/** Kun lentasi — 2 hafta, kalendar — 2 oygacha (sotuv bo'limi uzoqroq rejani qabul qilmaydi). */
const STRIP_DAYS = 14;
const MAX_DAYS = 60;
/** Bugun uchun: slot boshlanishi o'tib ketgan bo'lsa — yopiq (Toshkent soati, telefon mintaqasi emas). */
const slotPast = (day: string, s: string) => day === ymd(startOfToday()) && Number(s.slice(0, 2)) <= tashkentHour();
const dayFull = (day: string) => SLOTS.every((s) => slotPast(day, s));

const mln = (n: number) => fmtShort(n).replace('.', ',');

/** Demo `.pay`: 52 dp yuza tugma (sh1), tanlangani — brend chegara, brandSoft fon, brandInk matn. */
function PayOption({ label, icon, on, onPress }: { label: string; icon: IconName; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressScale
      accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}
      haptic={false} onPress={() => { haptic.selection(); onPress(); }}
      style={[{ flex: 1, height: size.buttonLg, borderRadius: radius.md + 2, borderCurve: 'continuous', borderWidth: size.ring, borderColor: on ? c.brand : 'transparent', backgroundColor: on ? c.brandSoft : c.bgSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm }, elevation(c).sh1]}
    >
      <Icon name={icon} size={size.iconMd - 1} tone={on ? 'brand' : 'strong'} strokeWidth={1.75} />
      <Txt v="bodyStrong" style={{ color: on ? c.brandInk : c.textStrong }} numberOfLines={1}>{label}</Txt>
    </PressScale>
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
  const [addr, setAddr] = useState<AddressValue>({ address: contact.address, lat: null, lng: null });
  const address = addr.address;
  const [day, setDay] = useState(() => ymd(addDays(startOfToday(), 1)));
  const [slot, setSlot] = useState<string | null>(null);
  const [pay, setPay] = useState<string>('Naqd');
  const [sheet, setSheet] = useState<null | 'address' | 'time' | 'contact'>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [placed, setPlaced] = useState<SentOrder[] | null>(null);
  // Ikki marta tez bosilsa (tugma `loading` bo'lib ulgurmasdan) buyurtmalar ikki marta ketmasin
  const inFlight = useRef(false);
  /** Shu buyurtma urinishining barqaror kaliti — har bosishda yangisi emas (`orderAttemptKey`). */
  const attempt = useRef<{ sig: string; key: string } | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(shop)/(tabs)/savat' as never));

  if (placed) {
    return <OrderSuccess orders={placed} onOrders={() => router.dismissTo('/(shop)/(tabs)/buyurtma' as never)} onDone={() => router.dismissTo('/(shop)' as never)} />;
  }

  const total = cartTotal(lines);
  const when = slot && !slotPast(day, slot) ? `${dayLabelLong(day)}, ${slot}` : null;
  const pickDay = (k: string) => { setDay(k); if (slot && slotPast(k, slot)) setSlot(null); };
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
    // Shop API'da sana va koordinata maydoni yo'q — sotuv bo'limi o'qiydigan izohga yoziladi
    const point = addr.lat != null && addr.lng != null
      ? `Obyekt nuqtasi: ${addr.lat.toFixed(6)}, ${addr.lng.toFixed(6)} (https://yandex.uz/maps/?pt=${addr.lng.toFixed(6)},${addr.lat.toFixed(6)}&z=17)` : null;
    const note = [when ? `Yetkazish vaqti: ${when} (${day})` : null, point, `To'lov: ${pay}`].filter(Boolean).join('. ');
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(0);
    let out: Awaited<ReturnType<typeof submitCart>>;
    try {
      const base = { name: name.trim(), phone: phone.trim(), address: address.trim(), note };
      attempt.current = orderAttemptKey(attempt.current, { lines: lines.map((l) => [l.productId, l.qty]), base });
      out = await submitCart(lines, base, (n) => setSending(n), attempt.current.key);
    } finally {
      inFlight.current = false;
      setSending(null);
    }
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
                  <Txt v="kv" color="strong">{fmtNum(total)} so&apos;m</Txt>
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
        <AddressPicker label="Manzil" value={addr} onChange={setAddr} placeholder="Shahar, ko'cha, uy, mo'ljal" mapHeight={200} />
      </Sheet>

      <Sheet open={sheet === 'time'} onClose={() => setSheet(null)} title="Yetkazish vaqti" footer={<Button title="Tayyor" size="lg" onPress={() => setSheet(null)} />}>
        <View style={{ gap: space.lg }}>
          <View style={{ gap: space.xs }}>
            <DayStrip value={day} onChange={pickDay} days={STRIP_DAYS} maxDays={MAX_DAYS} isDisabled={dayFull} />
            <Txt v="caption" color="muted">{dayLabelLong(day)}</Txt>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {SLOTS.map((s) => (
              <Button key={s} title={s} full={false} disabled={slotPast(day, s)} variant={slot === s ? 'primary' : 'secondary'} onPress={() => setSlot(slot === s ? null : s)} />
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
