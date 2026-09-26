import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Gap, Input, Screen, Select, Txt, fmtSum, fmtUnit } from '@/design/primitives';
import { toast } from '@/design/ui';
import { space } from '@/design/tokens';
import { useAction, useMaterials, useProjects } from '@/features/eco/api';

/** "Menga 20 qop sement kerak" — loyiha, material, miqdor, sabab. */
export default function NewRequest() {
  const router = useRouter();
  const projects = useProjects(); const mats = useMaterials();
  const [projectId, setProjectId] = useState(''); const [materialId, setMaterialId] = useState(''); const [qty, setQty] = useState(''); const [reason, setReason] = useState('');
  const create = useAction<{ projectId: string; materialId: string; quantity: number; reason?: string }>((body) => ({ path: '/material-requests', body }), ['material-requests', 'dash']);
  const m = mats.data?.find((x) => x.id === materialId);
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX }} keyboardShouldPersistTaps="handled">
        <Select label="Loyiha" required value={projectId || null} options={(projects.data ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.address }))} onChange={(v) => setProjectId(v)} />
        <Select label="Material" required value={materialId || null} options={(mats.data ?? []).map((x) => ({ value: x.id, label: x.name, hint: `omborda ${fmtUnit(x.stock, x.unit)}` }))} onChange={(v) => setMaterialId(v)} />
        <Input label={`Miqdor${m ? ` (${m.unit})` : ''}`} required value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="Masalan: 20" mono />
        <Input label="Sabab" value={reason} onChangeText={setReason} placeholder="Poydevor, devor…" />
        {m && qty ? (
          <Card style={{ marginBottom: space.lg }}>
            <Txt v="overline">Taxminiy qiymat</Txt>
            <Txt v="metric" color="brand">{fmtSum(Number(m.price) * Number(qty))}</Txt>
          </Card>
        ) : null}
        <Gap />
        <Button title="So'rov yuborish" icon="send" size="lg" disabled={!projectId || !materialId || !(Number(qty) > 0)} loading={create.isPending} onPress={() => create.mutate({ projectId, materialId, quantity: Number(qty), reason: reason || undefined }, { onSuccess: () => { toast.success('Tadbirkor ko\'rib chiqadi', 'Yuborildi'); router.back(); }, onError: (e) => toast.error(e.message, 'Xato') })} />
        <Gap h={space.xxxl} />
      </ScrollView>
    </Screen>
  );
}
