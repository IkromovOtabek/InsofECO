import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { HeroCard, SectionHead, StickyActionBar } from '@/design/blocks';
import { Card, Gap, Input, Screen, Select, fmtNum, fmtUnit } from '@/design/primitives';
import { toast } from '@/design/ui';
import { space } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { useAction, useMaterials, useProjects } from '@/features/eco/api';

/** "Menga 20 qop sement kerak" — obyekt → material va miqdor → sabab; yuborish pastki panelda. */
export default function NewRequest() {
  const router = useRouter();
  const projects = useProjects(); const mats = useMaterials();
  const [projectId, setProjectId] = useState(''); const [materialId, setMaterialId] = useState(''); const [qty, setQty] = useState(''); const [reason, setReason] = useState('');
  const create = useAction<{ projectId: string; materialId: string; quantity: number; reason?: string }>((body) => ({ path: '/material-requests', body }), ['material-requests', 'dash']);
  const m = mats.data?.find((x) => x.id === materialId);
  const quantity = Number(qty.replace(',', '.'));
  const qtyError = qty && !(quantity > 0) ? "Miqdor 0 dan katta son bo'lishi kerak" : undefined;
  const missing = !projectId ? 'Avval obyektni tanlang' : !materialId ? 'Materialni tanlang' : !(quantity > 0) ? 'Miqdorni kiriting' : undefined;
  const send = () => create.mutate({ projectId, materialId, quantity, reason: reason.trim() || undefined }, {
    onSuccess: () => { toast.success("Tadbirkor ko'rib chiqadi", 'Yuborildi'); router.back(); },
    onError: (e) => toast.error(e.message, 'Xato'),
  });
  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
          <Appear>
            <SectionHead title="Obyekt" icon="hard-hat" />
            <Card>
              <Select label="Obyekt" required value={projectId || null} options={(projects.data ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.address }))} onChange={(v) => setProjectId(v)} placeholder={projects.isLoading ? 'Yuklanmoqda…' : 'Obyektni tanlang'} containerStyle={{ marginBottom: 0 }} />
            </Card>

            <Gap h={space.section} />
            <SectionHead title="Material" icon="package" />
            <Card>
              <Select label="Material" required value={materialId || null} options={(mats.data ?? []).map((x) => ({ value: x.id, label: x.name, hint: `omborda ${fmtUnit(x.stock, x.unit)}` }))} onChange={(v) => setMaterialId(v)} placeholder={mats.isLoading ? 'Yuklanmoqda…' : 'Materialni tanlang'} />
              <Input label={`Miqdor${m ? ` (${m.unit})` : ''}`} required value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="Masalan: 20" mono error={qtyError} hint={m ? `Omborda ${fmtUnit(m.stock, m.unit)}` : undefined} containerStyle={{ marginBottom: 0 }} />
            </Card>

            {m && quantity > 0 ? (
              <>
                <Gap h={space.grid} />
                <HeroCard label="Taxminiy qiymat" value={Number(m.price) * quantity} format={(n) => fmtNum(Math.round(n))} unit="so'm" />
              </>
            ) : null}

            <Gap h={space.section} />
            <SectionHead title="Izoh" icon="file-text" />
            <Card>
              <Input label="Sabab (ixtiyoriy)" value={reason} onChangeText={setReason} placeholder="Poydevor, devor…" multiline containerStyle={{ marginBottom: 0 }} />
            </Card>
          </Appear>
        </ScrollView>
        <StickyActionBar primary={{ title: "So'rov yuborish", icon: 'send', loading: create.isPending, disabled: !!missing, disabledReason: missing, onPress: send }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
