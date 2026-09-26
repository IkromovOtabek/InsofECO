import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { WorkOrderCreateSchema, SPECIALTY_LABEL } from '@insof/shared';
import { Button, Gap, Input, Label, Screen, Select } from '@/design/primitives';
import { toast } from '@/design/ui';
import { space } from '@/design/tokens';
import { useAction, useProjects, useWorkers } from '@/features/eco/api';

/** Tadbirkor yangi ish buyurtmasi: loyiha → ish → narx/muddat → (ixtiyoriy) quruvchi. */
export default function NewWorkOrder() {
  const router = useRouter();
  const projects = useProjects();
  const workers = useWorkers();
  const [f, setF] = useState({ projectId: '', title: '', description: '', address: '', price: '', deadline: '', workerUserId: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useAction<Record<string, unknown>, { id: string }>((body) => ({ path: '/work-orders', body }), ['work-orders', 'dash']);
  const submit = () => {
    const parsed = WorkOrderCreateSchema.safeParse({ projectId: f.projectId || undefined, title: f.title, description: f.description || undefined, address: f.address, price: Number(f.price.replace(/\s/g, '')), deadline: f.deadline, workerUserId: f.workerUserId || undefined });
    if (!parsed.success) return toast.error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'), 'Tekshiring');
    create.mutate(parsed.data as never, { onSuccess: (o) => router.replace(`/work-order/${o.id}`), onError: (e) => toast.error(e.message, 'Xato') });
  };
  const projectOptions = (projects.data ?? []).filter((p) => p.status !== 'COMPLETED').map((p) => ({ value: p.id, label: p.name, hint: p.address }));
  const workerOptions = [
    { value: '', label: 'Ochiq buyurtma', hint: "Quruvchi keyinroq tanlanadi" },
    ...(workers.data ?? []).slice(0, 12).map((w) => ({
      value: w.userId, label: w.fullName ?? '—',
      hint: `${w.profile ? SPECIALTY_LABEL[w.profile.specialty as keyof typeof SPECIALTY_LABEL] : ''} · reyting ${w.profile?.ratingAvg ?? '—'}${w.activeWork ? ' · band' : " · bo'sh"}`,
    })),
  ];
  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.pageX }} keyboardShouldPersistTaps="handled">
          <Select label="Loyiha" value={f.projectId} options={projectOptions} placeholder="Loyihani tanlang" onChange={(v) => setF((s) => ({ ...s, projectId: v, address: s.address || (projects.data ?? []).find((p) => p.id === v)?.address || '' }))} />
          <Label>Ish</Label>
          <Input value={f.title} onChangeText={set('title')} placeholder="Masalan: Devor qurish (2-qavat)" />
          <Input value={f.description} onChangeText={set('description')} placeholder="Tavsif, talablar" multiline style={{ minHeight: space.x12 + space.xxxl, paddingTop: space.md, textAlignVertical: 'top' }} />
          <Input value={f.address} onChangeText={set('address')} placeholder="Manzil" left="map-pin" />
          <Label>Narx va muddat</Label>
          <Input value={f.price} onChangeText={set('price')} placeholder="To'lov, so'm" keyboardType="number-pad" mono />
          <Input value={f.deadline} onChangeText={set('deadline')} placeholder="Muddat (YYYY-MM-DD)" mono left="calendar-days" />
          <Select label="Quruvchi" value={f.workerUserId} options={workerOptions} onChange={(v) => set('workerUserId')(v)} />
          <Gap />
          <Button title="Buyurtmani yaratish" size="lg" onPress={submit} loading={create.isPending} />
          <Gap h={space.xxxl} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
