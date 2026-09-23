import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { CreateOrderSchema } from '@insof/shared';
import { Button, Card, Field, Gap, Row, Screen, Txt, fmtSum } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { useCreateOrder, useMixes, usePlants } from '@/features/orders/api';
import { useSites } from '@/features/sites/api';
import { ApiException } from '@/core/api';

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
    if (!parsed.success) return Alert.alert('Tekshiring', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    create.mutate(parsed.data, {
      onSuccess: (o) => { Alert.alert('Yuborildi', `Buyurtma №${o.number} zavodga yuborildi. Tasdiqlanganda xabar keladi.`); router.replace(`/order/${o.id}`); },
      onError: (e) => Alert.alert('Xato', e instanceof ApiException ? e.message : 'Tarmoq xatosi'),
    });
  };

  const Chip = ({ active, label, onPress, sub }: { active: boolean; label: string; sub?: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: active ? c.brandPrimary : c.border, backgroundColor: active ? c.brandPrimarySoft : c.bgSurface, marginRight: 8, marginBottom: 8 }}>
      <Txt v="bodyStrong" color={active ? 'brand' : 'primary'}>{label}</Txt>
      {sub ? <Txt v="caption" color="secondary">{sub}</Txt> : null}
    </Pressable>
  );

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Row style={{ gap: 6, marginBottom: 16 }}>
          {[1, 2, 3].map((s) => <Txt key={s} v="caption" style={{ flex: 1, textAlign: 'center', color: step >= s ? c.brandPrimary : c.textSecondary, fontWeight: step === s ? '700' : '400' }}>{s === 1 ? 'Beton' : s === 2 ? 'Obyekt va vaqt' : 'Tasdiqlash'}</Txt>)}
        </Row>

        {step === 1 && (
          <>
            <Txt v="heading">Zavod</Txt><Gap h={8} />
            <Row style={{ flexWrap: 'wrap' }}>{(plants.data ?? []).map((p) => <Chip key={p.id} active={plantId === p.id} label={p.name} sub={p.address ?? undefined} onPress={() => { setPlantId(p.id); setMixId(undefined); }} />)}</Row>
            <Gap />
            <Txt v="heading">Marka</Txt><Gap h={8} />
            <Row style={{ flexWrap: 'wrap' }}>{(mixes.data ?? []).map((m) => <Chip key={m.id} active={mixId === m.id} label={m.grade} sub={`${fmtSum(m.unitPrice)}/m³`} onPress={() => setMixId(m.id)} />)}</Row>
            {plantId && !mixes.data?.length ? <Txt color="secondary">Yuklanmoqda…</Txt> : null}
            <Gap />
            <Field label="Hajm (m³, 0.5 qadam)" value={volume} onChangeText={setVolume} keyboardType="decimal-pad" />
            <Card><Row style={{ justifyContent: 'space-between' }}><Txt>Nasos kerak</Txt><Switch value={needsPump} onValueChange={setNeedsPump} trackColor={{ true: c.brandPrimary }} /></Row></Card>
            <Gap h={20} />
            <Button title="Davom etish" onPress={() => setStep(2)} disabled={!plantId || !mixId || !(Number(volume) > 0)} />
          </>
        )}

        {step === 2 && (
          <>
            <Txt v="heading">Obyekt</Txt><Gap h={8} />
            <Row style={{ flexWrap: 'wrap' }}>
              {(sites.data ?? []).map((s) => <Chip key={s.id} active={siteId === s.id} label={s.name} sub={s.address} onPress={() => setSiteId(s.id)} />)}
              <Chip active={!siteId} label="Boshqa manzil" onPress={() => setSiteId(undefined)} />
            </Row>
            {!siteId ? <Field label="Manzil" value={address} onChangeText={setAddress} placeholder="Tuman, MFY, mo'ljal" /> : null}
            <Field label="Sana va vaqt (YYYY-MM-DDTHH:mm)" value={date} onChangeText={setDate} placeholder="2026-09-18T08:00" />
            <Field label="Mashinalar orasidagi interval (daqiqa)" value={interval} onChangeText={setInterval} keyboardType="number-pad" />
            <Field label="Izoh (ixtiyoriy)" value={note} onChangeText={setNote} placeholder="Kirish yo'li, mas'ul shaxs…" />
            <Row style={{ gap: 12 }}>
              <Button title="Orqaga" variant="secondary" style={{ flex: 1 }} onPress={() => setStep(1)} />
              <Button title="Davom etish" style={{ flex: 2 }} onPress={() => setStep(3)} disabled={!siteId && address.length < 5} />
            </Row>
          </>
        )}

        {step === 3 && (
          <>
            <Card>
              <Txt v="caption" color="secondary">BETON</Txt>
              <Txt v="heading">{mix?.grade} · {volume} m³{needsPump ? ' · nasos' : ''}</Txt>
              <Gap h={10} />
              <Txt v="caption" color="secondary">QAYERGA</Txt>
              <Txt>{site?.name ? `${site.name} — ${site.address}` : address}</Txt>
              <Gap h={10} />
              <Txt v="caption" color="secondary">QACHON</Txt>
              <Txt>{date.replace('T', ' ')} · har {interval} daqiqada</Txt>
              <Gap h={10} />
              <Txt v="caption" color="secondary">TAXMINIY NARX</Txt>
              <Txt v="title" color="brand">{fmtSum(estimate)}</Txt>
              <Txt v="caption" color="secondary">Yetkazish haqi zavod tasdiqlashda qo'shiladi</Txt>
            </Card>
            <Gap h={20} />
            <Row style={{ gap: 12 }}>
              <Button title="Orqaga" variant="secondary" style={{ flex: 1 }} onPress={() => setStep(2)} />
              <Button title="Yuborish" style={{ flex: 2 }} onPress={submit} loading={create.isPending} />
            </Row>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
