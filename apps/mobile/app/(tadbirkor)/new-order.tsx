import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WorkOrderCreateSchema, SPECIALTY_LABEL } from '@insof/shared';
import { StickyActionBar } from '@/design/blocks';
import { Card, Gap, Input, Screen, Select, Txt } from '@/design/primitives';
import { Appear, PressScale, haptic } from '@/design/motion';
import { toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space, toneColors } from '@/design/tokens';
import { useAction, useProjects, useWorkers } from '@/features/eco/api';
import { AddressPicker, type AddressValue } from '@/features/address/AddressPicker';
import { DayStrip, atTime, dayLabelLong, startOfToday, ymd } from '@/features/address/DayStrip';

const SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
/** Kun lentasi — 2 hafta; uzoqroq muddat (oy, chorak) — kalendardan. */
const STRIP_DAYS = 14;
const MAX_DAYS = 180;

/** Bo'lim sarlavhasi: raqamli doira + nom + izoh. */
function Step({ n, title, hint, done }: { n: number; title: string; hint?: string; done?: boolean }) {
  const { c } = useTheme();
  const t = toneColors(c, done ? 'success' : 'brand');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md }}>
      <View style={{ width: size.iconTileSm, height: size.iconTileSm, borderRadius: radius.pill, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Txt v="bodyStrong" style={{ color: t.ink }}>{String(n)}</Txt>
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="titleSm" accessibilityRole="header">{title}</Txt>
        {hint ? <Txt v="caption" color="muted">{hint}</Txt> : null}
      </View>
    </View>
  );
}

/** Vaqt sloti — 4 ustunli setka; o'tib ketgan vaqt yopiq. */
function Slot({ label, on, off, onPress }: { label: string; on: boolean; off: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressScale
      haptic={false} onPress={() => { haptic.selection(); onPress(); }} disabled={off}
      accessibilityRole="radio" accessibilityState={{ selected: on, disabled: off }} accessibilityLabel={label}
      style={{ flexGrow: 1, flexBasis: '22%', minHeight: size.touch, borderRadius: radius.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.brand : off ? c.bgMuted : c.bgSurface, borderWidth: size.hairline, borderColor: on ? c.brand : c.borderSubtle }}
    >
      <Txt v="label" mono color={on ? 'onBrand' : off ? 'faint' : 'strong'} style={off ? { textDecorationLine: 'line-through' } : undefined}>{label}</Txt>
    </PressScale>
  );
}

/** Tadbirkor yangi ish buyurtmasi: 1) loyiha va ish → 2) obyekt va muddat (kun chiplari + vaqt slotlari) → 3) narx va quruvchi. */
export default function NewWorkOrder() {
  const router = useRouter();
  const projects = useProjects();
  const workers = useWorkers();
  const [f, setF] = useState({ projectId: '', title: '', description: '', address: '', price: '', workerUserId: '' });
  /** Xarita nuqtasi — ish buyurtmasi API'sida koordinata maydoni yo'q, hozircha faqat manzil matni yuboriladi. */
  const [pin, setPin] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [day, setDay] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useAction<Record<string, unknown>, { id: string }>((body) => ({ path: '/work-orders', body }), ['work-orders', 'dash']);
  const today = ymd(startOfToday());
  const nowH = new Date().getHours();
  const slotOff = (s: string) => day === today && Number(s.slice(0, 2)) <= nowH;
  /** Bugungi barcha slotlar o'tgan bo'lsa bugun yopiq. */
  const dayFull = (k: string) => k === today && SLOTS.every((x) => Number(x.slice(0, 2)) <= nowH);
  // Muddat — telefon vaqtida yig'iladi va ISO (UTC) bo'lib ketadi. Ilgari "YYYY-MM-DDTHH:mm"
  // satri mintaqasiz yuborilardi va UTC serverda 5 soat siljirdi (18:00 → 23:00).
  const deadline = day && time ? atTime(day, time).toISOString() : '';

  // Tez ikki bosish — ikkita ish buyurtmasi yaratilmasin (har mutate yangi idempotency kalit)
  const sending = useRef(false);
  const submit = () => {
    if (sending.current) return;
    const parsed = WorkOrderCreateSchema.safeParse({ projectId: f.projectId || undefined, title: f.title, description: f.description || undefined, address: f.address, price: Number(f.price.replace(/\s/g, '')), deadline, workerUserId: f.workerUserId || undefined });
    if (!parsed.success) return toast.error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'), 'Tekshiring');
    sending.current = true;
    create.mutate(parsed.data as never, { onSettled: () => { sending.current = false; }, onSuccess: (o) => router.replace(`/work-order/${o.id}`), onError: (e) => toast.error(e.message, 'Xato') });
  };
  const projectOptions = (projects.data ?? []).filter((p) => p.status !== 'COMPLETED').map((p) => ({ value: p.id, label: p.name, hint: p.address }));
  const workerOptions = [
    { value: '', label: 'Ochiq buyurtma', hint: "Quruvchi keyinroq tanlanadi" },
    ...(workers.data ?? []).slice(0, 12).map((w) => ({
      value: w.userId, label: w.fullName ?? '—',
      hint: `${w.profile ? SPECIALTY_LABEL[w.profile.specialty as keyof typeof SPECIALTY_LABEL] : ''} · reyting ${w.profile?.ratingAvg ?? '—'}${w.activeWork ? ' · band' : " · bo'sh"}`,
    })),
  ];
  const step1 = f.title.trim().length >= 2;
  const step2 = f.address.trim().length >= 3 && !!deadline;
  const step3 = Number(f.price.replace(/\s/g, '')) > 0;
  const missing = !step1 ? 'Ish nomini kiriting' : f.address.trim().length < 3 ? 'Manzilni kiriting' : !day ? 'Muddat kunini tanlang' : !time ? 'Muddat vaqtini tanlang' : !step3 ? "To'lov summasini kiriting" : undefined;
  const dayLabel = day ? dayLabelLong(day) : '';
  const addr: AddressValue = { address: f.address, lat: pin.lat, lng: pin.lng };

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.pageX, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
          <Appear>
            <Card>
              <Step n={1} title="Loyiha va ish" hint="Qaysi obyektda, qanday ish" done={step1} />
              <Select label="Loyiha" value={f.projectId} options={projectOptions} placeholder="Loyihani tanlang" onChange={(v) => setF((s) => ({ ...s, projectId: v, address: s.address || (projects.data ?? []).find((p) => p.id === v)?.address || '' }))} />
              <Input label="Ish" required value={f.title} onChangeText={set('title')} placeholder="Masalan: Devor qurish (2-qavat)" />
              <Input label="Tavsif" value={f.description} onChangeText={set('description')} placeholder="Tavsif, talablar" multiline containerStyle={{ marginBottom: 0 }} style={{ minHeight: space.x12 + space.xxxl, paddingTop: space.md, textAlignVertical: 'top' }} />
            </Card>

            <Gap h={space.grid} />
            <Card>
              <Step n={2} title="Obyekt va muddat" hint={deadline ? `Muddat: ${dayLabel} · ${time}` : 'Kun va vaqtni tanlang'} done={step2} />
              <AddressPicker label="Obyekt manzili" required value={addr} onChange={(v) => { set('address')(v.address); setPin({ lat: v.lat, lng: v.lng }); }} />
              <Txt v="overline" style={{ marginTop: space.lg, marginBottom: space.sm }}>Kun</Txt>
              <DayStrip value={day} onChange={(k) => { setDay(k); if (k === today && time && Number(time.slice(0, 2)) <= nowH) setTime(''); }} days={STRIP_DAYS} maxDays={MAX_DAYS} isDisabled={dayFull} />
              <Txt v="overline" style={{ marginTop: space.lg, marginBottom: space.sm }}>Vaqt</Txt>
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {SLOTS.map((s) => <Slot key={s} label={s} on={time === s} off={slotOff(s)} onPress={() => setTime(s)} />)}
              </View>
            </Card>

            <Gap h={space.grid} />
            <Card>
              <Step n={3} title="Narx va quruvchi" hint="Quruvchini keyin ham biriktirsa bo'ladi" done={step3} />
              <Input label="To'lov" required value={f.price} onChangeText={set('price')} placeholder="To'lov, so'm" keyboardType="number-pad" mono left="banknote" />
              <Select label="Quruvchi" value={f.workerUserId} options={workerOptions} onChange={(v) => set('workerUserId')(v)} />
            </Card>
          </Appear>
        </ScrollView>
        <StickyActionBar primary={{ title: 'Buyurtmani yaratish', icon: 'check', onPress: submit, loading: create.isPending, disabled: !!missing, disabledReason: missing }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
