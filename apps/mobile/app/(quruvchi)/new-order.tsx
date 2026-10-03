import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CreateOrderSchema } from '@insof/shared';
import { HeroCard, ListGroup, SectionHead, StickyActionBar, Toggle } from '@/design/blocks';
import { Callout, Card, Gap, IconButton, Input, ListItem, Screen, Select, Txt, fmtM3, fmtNum, fmtSum } from '@/design/primitives';
import { AddressPicker, type AddressValue } from '@/features/address/AddressPicker';
import { DayStrip, addDays, atTime, dayLabelLong, startOfToday, ymd } from '@/features/address/DayStrip';
import { Appear, PressScale, haptic } from '@/design/motion';
import { toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space } from '@/design/tokens';
import { useCreateOrder, useMixes, usePlants } from '@/features/orders/api';
import { useSites } from '@/features/sites/api';
import { ApiException } from '@/core/api';

const OTHER = '__other';
const STEP_TITLES = ['Beton', 'Obyekt va vaqt', 'Tasdiqlash'];
/** Boshlanish vaqti slotlari (soat). Tushlik soati (12) yo'q. */
const SLOTS = [7, 8, 9, 10, 11, 13, 14, 15, 16, 17];
/** Bugun uchun eng erta slot — hozirdan kamida shuncha soat keyin (zavod tayyorlanishi). */
const LEAD_HOURS = 2;
/** Kun lentasi (2 hafta) va kalendar chegarasi — zavod 2 oydan uzoq rejani qabul qilmaydi. */
const STRIP_DAYS = 14;
const MAX_DAYS = 60;
const INTERVAL_STEP = 5;
const INTERVAL_MAX = 240;

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
/** Kun (mahalliy `YYYY-MM-DD`) + soat → mahalliy vaqt; serverga ISO (UTC) bo'lib ketadi — siljish yo'q. */
const slotAt = (day: string, h: number) => atTime(day, hh(h));
const slotPast = (day: string, h: number) => slotAt(day, h).getTime() < Date.now() + LEAD_HOURS * 3_600_000;
/** Kunning barcha slotlari o'tib ketgan — lentada yopiq. */
const dayFull = (day: string) => SLOTS.every((h) => slotPast(day, h));

/** Zod xatolarini odam tilida: maydon nomi bo'yicha. */
const FIELD_MSG: Record<string, string> = {
  plantOrgId: 'Zavodni tanlang',
  address: "Manzil 5 dan 200 belgigacha bo'lsin",
  location: 'Obyekt nuqtasi belgilanmagan — manzilni takliflardan tanlang, xaritada pinni qo\'ying yoki «Joylashuvim»ni bosing',
  items: 'Marka va hajmni tanlang (hajm 0,5 m³ qadam bilan, 500 m³ gacha)',
  scheduledAt: 'Kun va boshlanish vaqtini tanlang',
  intervalMinutes: "Mikserlar oralig'i 0–240 daqiqa bo'lsin",
  note: 'Izoh 500 belgidan oshmasin',
};

/**
 * 3 qadamli wizard: (1) zavod + marka + hajm + nasos → (2) obyekt + kun + vaqt sloti + interval → (3) ko'rib chiqish.
 * Validatsiya — backend bilan bitta zod sxema (CreateOrderSchema); xatolar odam tilida.
 * "Boshqa manzil" uchun koordinata telefon joylashuvidan olinadi (soxta koordinata yuborilmaydi).
 */
export default function NewOrder() {
  const { c } = useTheme();
  const router = useRouter();
  const plants = usePlants();
  const sites = useSites();
  const [step, setStep] = useState(1);
  const [plantId, setPlantId] = useState<string>();
  const mixes = useMixes(plantId);
  const [mixId, setMixId] = useState<string>();
  const [volume, setVolume] = useState('8');
  const [needsPump, setNeedsPump] = useState(false);
  const [siteId, setSiteId] = useState<string>();
  const [addr, setAddr] = useState<AddressValue>({ address: '', lat: null, lng: null });
  // Standart — ertaga (bugun ko'pincha zavod ulgurmaydi); bugungi slotlar qolgan bo'lsa ham tanlasa bo'ladi
  const [day, setDay] = useState(() => ymd(addDays(startOfToday(), 1)));
  const [slot, setSlot] = useState<number | null>(8);
  const [interval, setInterval] = useState(30);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const create = useCreateOrder();

  const site = sites.data?.find((s) => s.id === siteId);
  const mix = mixes.data?.find((m) => m.id === mixId);
  const vol = Number(volume.replace(',', '.'));
  const estimate = mix ? Number(mix.unitPrice) * (vol || 0) : 0;
  const scheduled = slot != null ? slotAt(day, slot) : null;
  const address = addr.address;
  const loc = addr.lat != null && addr.lng != null ? { lat: addr.lat, lng: addr.lng } : null;

  const payload = useMemo(() => ({
    plantOrgId: plantId, siteId, address: (site?.address ?? address).trim(), location: site ? { lat: site.lat, lng: site.lng } : loc ?? undefined,
    items: mixId ? [{ mixId, volumeM3: vol }] : [], scheduledAt: scheduled ?? undefined, intervalMinutes: interval, needsPump, note: note.trim() || undefined,
  }), [plantId, siteId, site, address, loc, mixId, vol, scheduled, interval, needsPump, note]);

  // Qadam bo'yicha yopiq sabab — tugma jim turmaydi, sababni aytadi.
  const volError = volume && !(vol > 0 && vol <= 500 && Number.isInteger(vol * 2)) ? "Hajm 0,5 m³ qadam bilan, 500 m³ gacha" : undefined;
  const step1Block = !plantId ? 'Avval zavodni tanlang' : !mixId ? 'Markani tanlang' : !(vol > 0) || volError ? volError ?? 'Hajmni kiriting' : undefined;
  const addressError = !siteId && touched && address.trim().length < 5 ? "Manzil kamida 5 belgi: tuman, ko'cha, mo'ljal" : undefined;
  const step2Block = !siteId && address.trim().length < 5 ? 'Manzilni kiriting (kamida 5 belgi)'
    : !siteId && !loc ? 'Obyekt nuqtasini belgilang: taklifdan tanlang, xaritada pin yoki «Joylashuvim»'
    : slot == null ? 'Boshlanish vaqtini tanlang'
    : scheduled && scheduled.getTime() < Date.now() + LEAD_HOURS * 3_600_000 ? 'Bu vaqt o\'tib ketgan — keyinroq slotni tanlang' : undefined;

  const submit = () => {
    const parsed = CreateOrderSchema.safeParse(payload);
    if (!parsed.success) {
      const msgs = [...new Set(parsed.error.issues.map((i) => FIELD_MSG[String(i.path[0])] ?? "Ma'lumotlarni tekshiring"))];
      return toast.error(msgs.join('\n'), 'Tekshiring');
    }
    create.mutate(parsed.data, {
      onSuccess: (o) => { toast.success(`Buyurtma №${o.number} zavodga yuborildi. Tasdiqlanganda xabar keladi.`, 'Yuborildi'); router.replace(`/order/${o.id}`); },
      onError: (e) => toast.error(e instanceof ApiException ? e.message : "Tarmoq xatosi — internetni tekshirib qayta urinib ko'ring", 'Xato'),
    });
  };

  const plantOptions = (plants.data ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.address ?? undefined }));
  const mixOptions = (mixes.data ?? []).map((m) => ({ value: m.id, label: m.grade, hint: `${fmtSum(m.unitPrice)} / m³` }));
  const siteOptions = [...(sites.data ?? []).map((s) => ({ value: s.id, label: s.name, hint: s.address })), { value: OTHER, label: 'Boshqa manzil', hint: "Manzilni qo'lda kiritaman" }];
  const pickDay = (k: string) => { setDay(k); if (slot != null && slotPast(k, slot)) setSlot(null); };

  const next = () => (step === 1 ? setStep(2) : step === 2 ? setStep(3) : submit());
  const block = step === 1 ? step1Block : step === 2 ? step2Block : undefined;

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.md }} accessible accessibilityRole="progressbar" accessibilityLabel={`${step}-qadam: ${STEP_TITLES[step - 1]}`} accessibilityValue={{ min: 1, max: 3, now: step }}>
          <View style={{ flexDirection: 'row', gap: space.xs + 2 }}>
            {STEP_TITLES.map((t, i) => <View key={t} style={{ flex: 1, height: size.progress, borderRadius: radius.pill, backgroundColor: step >= i + 1 ? c.brand : c.bgMuted }} />)}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
            <Txt v="overline">{STEP_TITLES[step - 1]}</Txt>
            <Txt v="caption" color="muted">{step} / 3</Txt>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
          <Appear replay={step} from={10}>
            {step === 1 && (
              <>
                <SectionHead title="Zavod va marka" icon="factory" />
                <Card>
                  <Select label="Zavod" required value={plantId ?? null} options={plantOptions} placeholder={plants.isLoading ? 'Yuklanmoqda…' : 'Zavodni tanlang'} onChange={(v) => { setPlantId(v); setMixId(undefined); }} />
                  <Select label="Marka" required value={mixId ?? null} options={mixOptions} placeholder={!plantId ? 'Avval zavodni tanlang' : mixes.isLoading ? 'Markalar yuklanmoqda…' : 'Markani tanlang'} onChange={(v) => setMixId(v)} containerStyle={{ marginBottom: 0 }} />
                </Card>
                <Gap h={space.section} />
                <SectionHead title="Hajm va nasos" icon="layers" />
                <Card>
                  <Input label="Hajm, m³" required hint="0,5 m³ qadam bilan" value={volume} onChangeText={setVolume} keyboardType="decimal-pad" mono error={volError} />
                  <Toggle label="Nasos kerak" hint="Beton nasos bilan quyiladi" value={needsPump} onChange={setNeedsPump} />
                </Card>
                {mix && vol > 0 && !volError ? (
                  <>
                    <Gap h={space.grid} />
                    <HeroCard label="Taxminiy narx" value={estimate} format={(n) => fmtNum(Math.round(n))} unit="so'm" />
                  </>
                ) : null}
              </>
            )}

            {step === 2 && (
              <>
                <SectionHead title="Obyekt" icon="map-pin" />
                <Card>
                  <Select label="Obyekt" value={siteId ?? OTHER} options={siteOptions} onChange={(v) => setSiteId(v === OTHER ? undefined : v)} containerStyle={siteId ? { marginBottom: 0 } : undefined} />
                  {!siteId ? (
                    <AddressPicker
                      label="Obyekt manzili" required error={addressError}
                      value={addr} onChange={(v) => { setAddr(v); if (v.address.trim().length >= 5) setTouched(true); }}
                      placeholder="Tuman, ko'cha, uy yoki mo'ljal"
                    />
                  ) : site ? <Txt v="caption" color="muted" style={{ marginTop: space.sm }}>{site.address}</Txt> : null}
                </Card>

                <Gap h={space.section} />
                <SectionHead title="Kun" icon="calendar-days" />
                <DayStrip value={day} onChange={pickDay} days={STRIP_DAYS} maxDays={MAX_DAYS} isDisabled={dayFull} />
                <Txt v="caption" color="muted" style={{ marginTop: space.xs }}>{dayLabelLong(day)}</Txt>

                <Gap h={space.section} />
                <SectionHead title="Boshlanish vaqti" icon="clock" />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityRole="radiogroup">
                  {SLOTS.map((h) => {
                    const past = slotPast(day, h);
                    const on = slot === h && !past;
                    return (
                      <PressScale
                        key={h} disabled={past} haptic={false}
                        onPress={() => { haptic.selection(); setSlot(h); }}
                        accessibilityRole="radio" accessibilityState={{ selected: on, disabled: past }} accessibilityLabel={`${hh(h)}${past ? ", o'tib ketgan" : ''}`}
                        style={[
                          { flexBasis: '22%', flexGrow: 1, height: size.touch, borderRadius: radius.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.brand : past ? c.bgMuted : c.bgSurface },
                          !on && !past ? shadow.card : null,
                        ]}
                      >
                        <Txt v="bodyStrong" mono style={{ color: on ? c.textOnBrand : past ? c.textFaint : c.textStrong, textDecorationLine: past ? 'line-through' : 'none' }}>{hh(h)}</Txt>
                      </PressScale>
                    );
                  })}
                </View>
                {dayFull(day) ? <Callout tone="info" icon="info" style={{ marginTop: space.md }}>Bu kunga bo&apos;sh vaqt qolmadi — boshqa kunni tanlang</Callout> : null}

                <Gap h={space.section} />
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong">Mikserlar oralig&apos;i</Txt>
                    <Txt v="caption">Har mashina orasidagi vaqt</Txt>
                  </View>
                  <IconButton icon="minus" label="Kamaytirish" variant="secondary" disabled={interval <= 0} onPress={() => setInterval((v) => Math.max(0, v - INTERVAL_STEP))} />
                  <Txt v="titleSm" align="center" style={{ minWidth: space.x12 + space.lg }}>{`${interval} daq`}</Txt>
                  <IconButton icon="plus" label="Ko'paytirish" variant="secondary" disabled={interval >= INTERVAL_MAX} onPress={() => setInterval((v) => Math.min(INTERVAL_MAX, v + INTERVAL_STEP))} />
                </Card>

                <Gap h={space.section} />
                <SectionHead title="Izoh" icon="file-text" />
                <Card>
                  <Input label="Izoh (ixtiyoriy)" value={note} onChangeText={setNote} placeholder="Kirish yo'li, mas'ul shaxs…" multiline maxLength={500} containerStyle={{ marginBottom: 0 }} />
                </Card>
              </>
            )}

            {step === 3 && (
              <>
                <SectionHead title="Buyurtma" icon="clipboard-list" />
                <ListGroup>
                  <ListItem icon="factory" module="production" title={mix?.grade ?? '—'} subtitle={`${fmtM3(vol)}${needsPump ? ' · nasos bilan' : ''}`} onPress={() => setStep(1)} />
                  <ListItem icon="map-pin" module="logistics" title={site?.name ?? 'Boshqa manzil'} subtitle={site?.address ?? address} onPress={() => setStep(2)} />
                  <ListItem icon="calendar-days" module="brand" title={scheduled ? `${dayLabelLong(day)}, ${hh(slot!)}` : '—'} subtitle={`Mikserlar oralig'i ${interval} daqiqa`} onPress={() => setStep(2)} />
                  {note.trim() ? <ListItem icon="file-text" title="Izoh" subtitle={note.trim()} /> : null}
                </ListGroup>
                <Gap h={space.grid} />
                <HeroCard label="Taxminiy narx" value={estimate} format={(n) => fmtNum(Math.round(n))} unit="so'm" />
                <Txt v="caption" color="muted" style={{ marginTop: space.sm, marginLeft: space.xs }}>Yetkazish haqi zavod tasdiqlashda qo&apos;shiladi</Txt>
              </>
            )}
          </Appear>
        </ScrollView>

        <StickyActionBar
          primary={{ title: step === 3 ? 'Yuborish' : 'Davom etish', icon: step === 3 ? 'send' : 'arrow-right', loading: create.isPending, disabled: !!block, disabledReason: block, onPress: next }}
          secondary={step > 1 ? { title: 'Orqaga', icon: 'arrow-left', onPress: () => setStep(step - 1) } : undefined}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
