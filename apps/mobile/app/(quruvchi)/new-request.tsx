import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Field, Gap, SectionLabel, Txt, fmtSum } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { useAction, useMaterials, useProjects } from '@/features/eco/api';

/** "Menga 20 qop sement kerak" — loyiha, material, miqdor, sabab. */
export default function NewRequest() {
  const router = useRouter();
  const { c } = useTheme();
  const projects = useProjects(); const mats = useMaterials();
  const [projectId, setProjectId] = useState(''); const [materialId, setMaterialId] = useState(''); const [qty, setQty] = useState(''); const [reason, setReason] = useState('');
  const create = useAction<{ projectId: string; materialId: string; quantity: number; reason?: string }>((body) => ({ path: '/material-requests', body }), ['material-requests', 'dash']);
  const m = mats.data?.find((x) => x.id === materialId);
  const Chip = ({ active, label, sub, onPress }: { active: boolean; label: string; sub?: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: active ? c.brandPrimarySoft : c.bgSurface, borderWidth: 1, borderColor: active ? c.brandPrimary : c.border, marginRight: 8, marginBottom: 8 }}><Txt v="caption" style={{ fontWeight: '600', color: active ? c.brandPrimary : c.textPrimary }}>{label}</Txt>{sub ? <Txt v="caption" color="secondary">{sub}</Txt> : null}</Pressable>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <SectionLabel>Loyiha</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{(projects.data ?? []).map((p) => <Chip key={p.id} active={projectId === p.id} label={p.name} onPress={() => setProjectId(p.id)} />)}</View>
      <SectionLabel>Material</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{(mats.data ?? []).map((x) => <Chip key={x.id} active={materialId === x.id} label={x.name} sub={`omborda ${Number(x.stock)} ${x.unit}`} onPress={() => setMaterialId(x.id)} />)}</View>
      <SectionLabel>{`Miqdor${m ? ` (${m.unit})` : ''}`}</SectionLabel>
      <Field value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="Masalan: 20" />
      <Field value={reason} onChangeText={setReason} placeholder="Sabab (Poydevor, Devor...)" />
      {m && qty ? <Card><Txt v="callout" color="secondary">Taxminiy qiymat</Txt><Txt v="subtitle" color="brand">{fmtSum(Number(m.price) * Number(qty))}</Txt></Card> : null}
      <Gap />
      <Button title="SO'ROV YUBORISH" disabled={!projectId || !materialId || !(Number(qty) > 0)} loading={create.isPending} onPress={() => create.mutate({ projectId, materialId, quantity: Number(qty), reason: reason || undefined }, { onSuccess: () => { Alert.alert('Yuborildi', 'Tadbirkor ko\'rib chiqadi'); router.back(); }, onError: (e) => Alert.alert('Xato', e.message) })} />
    </ScrollView>
  );
}
