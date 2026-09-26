import React, { useMemo, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CreateOrderSchema } from '@insof/shared';
import { Button, Card, Gap, Input, Row, Screen, Select, Txt, fmtM3, fmtSum } from '@/design/primitives';
import { toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useCreateOrder, useMixes, usePlants } from '@/features/orders/api';
import { useSites } from '@/features/sites/api';
import { ApiException } from '@/core/api';

const OTHER = '__other';
const STEP_TITLES = ['Beton', 'Obyekt va vaqt', 'Tasdiqlash'];

/**
 * 3 qadamli wizard: (1) zavod + marka + hajm + nasos → (2) obyekt + vaqt + interval → (3) ko'rib chiqish.
 * Validatsiya — backend bilan bitta zod sxema (CreateOrderSchema).
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
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d.toISOString().slice(0, 16); });
  const [interval, setInterval] = useState('30');
  const [note, setNote] = useState('');
  const create = useCreateOrder();

  const site = sites.data?.find((s) => s.id === siteId);
  const mix = mixes.data?.find((m) => m.id === mixId);
  const estimate = mix ? Number(mix.unitPrice) * Number(volume || 0) : 0;

  const payload = useMemo(() => ({
    plantOrgId: plantId, siteId, address: site?.address ?? address, location: site ? { lat: site.lat, lng: site.lng } : { lat: 41.0, lng: 71.8 },
    items: mixId ? [{ mixId, volumeM3: Number(volume) }] : [], scheduledAt: new Date(date), intervalMinutes: Number(interval), needsPump, note: note || undefined,
  }), [plantId, siteId, site, address, mixId, volume, date, interval, needsPump, note]);

  const submit = () => {
    const parsed = CreateOrderSchema.safeParse(payload);
    if (!parsed.success) return toast.error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'), 'Tekshiring');
    create.mutate(parsed.data, {
      onSuccess: (o) => { toast.success(`Buyurtma №${o.number} zavodga yuborildi. Tasdiqlanganda xabar keladi.`, 'Yuborildi'); router.replace(`/order/${o.id}`); },
      onError: (e) => toast.error(e instanceof ApiException ? e.message : 'Tarmoq xatosi — internetni tekshirib qayta urinib ko\'ring', 'Xato'),
    });
  };

  const plantOptions = (plants.data ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.address ?? undefined }));
  const mixOptions = (mixes.data ?? []).map((m) => ({ value: m.id, label: m.grade, hint: `${fmtSum(m.unitPrice)} / m³` }));
  const siteOptions = [...(sites.data ?? []).map((s) => ({ value: s.id, label: s.name, hint: s.address })), { value: OTHER, label: 'Boshqa manzil', hint: 'Manzilni qo\'lda kiritaman' }];

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX }} keyboardShouldPersistTaps="handled">
        <Row style={{ gap: space.sm, marginBottom: space.lg }} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 3, now: step }}>
          {STEP_TITLES.map((t, i) => <Txt key={t} v={step === i + 1 ? 'label' : 'caption'} color={step >= i + 1 ? 'brand' : 'muted'} align="center" style={{ flex: 1 }}>{i + 1}. {t}</Txt>)}
        </Row>

        {step === 1 && (
          <>
            <Select label="Zavod" value={plantId ?? null} options={plantOptions} onChange={(v) => { setPlantId(v); setMixId(undefined); }} />
            <Select label="Marka" value={mixId ?? null} options={mixOptions} placeholder={plantId ? 'Markani tanlang' : 'Avval zavodni tanlang'} onChange={(v) => setMixId(v)} />
            {plantId && mixes.isLoading ? <Txt v="caption" style={{ marginBottom: space.lg }}>Markalar yuklanmoqda…</Txt> : null}
            <Input label="Hajm" hint="m³, 0.5 qadam" value={volume} onChangeText={setVolume} keyboardType="decimal-pad" mono />
            <Card>
              <Row style={{ justifyContent: 'space-between', gap: space.sm }}>
                <Txt v="bodyStrong">Nasos kerak</Txt>
                <Switch value={needsPump} onValueChange={setNeedsPump} trackColor={{ true: c.brand }} accessibilityLabel="Nasos kerak" />
              </Row>
            </Card>
            <Gap h={space.xl} />
            <Button title="Davom etish" iconRight="arrow-right" size="lg" onPress={() => setStep(2)} disabled={!plantId || !mixId || !(Number(volume) > 0)} />
          </>
        )}

        {step === 2 && (
          <>
            <Select label="Obyekt" value={siteId ?? OTHER} options={siteOptions} onChange={(v) => setSiteId(v === OTHER ? undefined : v)} />
            {!siteId ? <Input label="Manzil" value={address} onChangeText={setAddress} placeholder="Tuman, MFY, mo'ljal" left="map-pin" /> : null}
            <Input label="Sana va vaqt" hint="YYYY-MM-DDTHH:mm" value={date} onChangeText={setDate} placeholder="2026-09-18T08:00" mono left="calendar-days" />
            <Input label="Mashinalar orasidagi interval" hint="daqiqa" value={interval} onChangeText={setInterval} keyboardType="number-pad" mono />
            <Input label="Izoh (ixtiyoriy)" value={note} onChangeText={setNote} placeholder="Kirish yo'li, mas'ul shaxs…" />
            <Row style={{ gap: space.md }}>
              <Button title="Orqaga" variant="secondary" size="lg" icon="arrow-left" style={{ flex: 1 }} onPress={() => setStep(1)} />
              <Button title="Davom etish" iconRight="arrow-right" size="lg" style={{ flex: 2 }} onPress={() => setStep(3)} disabled={!siteId && address.length < 5} />
            </Row>
          </>
        )}

        {step === 3 && (
          <>
            <Card>
              <Txt v="overline">Beton</Txt>
              <Txt v="titleSm">{mix?.grade} · {fmtM3(volume)}{needsPump ? ' · nasos' : ''}</Txt>
              <Gap h={space.md} />
              <Txt v="overline">Qayerga</Txt>
              <Txt>{site?.name ? `${site.name} — ${site.address}` : address}</Txt>
              <Gap h={space.md} />
              <Txt v="overline">Qachon</Txt>
              <Txt>{date.replace('T', ' ')} · har {interval} daqiqada</Txt>
              <Gap h={space.md} />
              <Txt v="overline">Taxminiy narx</Txt>
              <Txt v="metric" color="brand">{fmtSum(estimate)}</Txt>
              <Txt v="caption">Yetkazish haqi zavod tasdiqlashda qo&apos;shiladi</Txt>
            </Card>
            <Gap h={space.xl} />
            <Row style={{ gap: space.md }}>
              <Button title="Orqaga" variant="secondary" size="lg" icon="arrow-left" style={{ flex: 1 }} onPress={() => setStep(2)} />
              <Button title="Yuborish" icon="send" size="lg" style={{ flex: 2 }} onPress={submit} loading={create.isPending} />
            </Row>
          </>
        )}
        <View style={{ height: space.xxxl }} />
      </ScrollView>
    </Screen>
  );
}
