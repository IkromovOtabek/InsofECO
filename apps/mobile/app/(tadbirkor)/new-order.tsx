import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WorkOrderCreateSchema, SPECIALTY_LABEL } from '@insof/shared';
import { Button, Field, Gap, SectionLabel, Txt } from '@/design/primitives';
import { Avatar } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useAction, useProjects, useWorkers } from '@/features/eco/api';

/** Tadbirkor yangi ish buyurtmasi: loyiha → ish → narx/muddat → (ixtiyoriy) quruvchi. */
export default function NewWorkOrder() {
  const router = useRouter();
  const { c } = useTheme();
  const projects = useProjects();
  const workers = useWorkers();
  const [f, setF] = useState({ projectId: '', title: '', description: '', address: '', price: '', deadline: '', workerUserId: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useAction<Record<string, unknown>, { id: string }>((body) => ({ path: '/work-orders', body }), ['work-orders', 'dash']);
  const submit = () => {
    const parsed = WorkOrderCreateSchema.safeParse({ projectId: f.projectId || undefined, title: f.title, description: f.description || undefined, address: f.address, price: Number(f.price.replace(/\s/g, '')), deadline: f.deadline, workerUserId: f.workerUserId || undefined });
    if (!parsed.success) return Alert.alert('Tekshiring', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    create.mutate(parsed.data as never, { onSuccess: (o) => router.replace(`/work-order/${o.id}`), onError: (e) => Alert.alert('Xato', e.message) });
  };
  const Chip = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: active ? c.brandPrimarySoft : c.bgSurface, borderWidth: 1, borderColor: active ? c.brandPrimary : c.border, marginRight: 8, marginBottom: 8 }}><Txt v="caption" style={{ fontWeight: '600', color: active ? c.brandPrimary : c.textPrimary }}>{label}</Txt></Pressable>
  );
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <SectionLabel>Loyiha</SectionLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{(projects.data ?? []).filter((p) => p.status !== 'COMPLETED').map((p) => <Chip key={p.id} active={f.projectId === p.id} label={p.name} onPress={() => setF((s) => ({ ...s, projectId: p.id, address: s.address || p.address }))} />)}</View>
        <SectionLabel>Ish</SectionLabel>
        <Field value={f.title} onChangeText={set('title')} placeholder="Masalan: Devor qurish (2-qavat)" />
        <Field value={f.description} onChangeText={set('description')} placeholder="Tavsif, talablar" multiline style={{ height: 80, paddingTop: 12 }} />
        <Field value={f.address} onChangeText={set('address')} placeholder="Manzil" />
        <SectionLabel>Narx va muddat</SectionLabel>
        <Field value={f.price} onChangeText={set('price')} placeholder="To'lov, so'm" keyboardType="number-pad" />
        <Field value={f.deadline} onChangeText={set('deadline')} placeholder="Deadline (YYYY-MM-DD)" />
        <SectionLabel>Quruvchi (ixtiyoriy — bo'sh qolsa ochiq buyurtma)</SectionLabel>
        {(workers.data ?? []).slice(0, 12).map((w) => (
          <Pressable key={w.userId} onPress={() => set('workerUserId')(f.workerUserId === w.userId ? '' : w.userId)} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: f.workerUserId === w.userId ? c.brandPrimarySoft : 'transparent', marginBottom: 4 }}>
            <Avatar name={w.fullName} size={36} /><View style={{ flex: 1, marginLeft: 10 }}><Txt v="bodyStrong">{w.fullName}</Txt><Txt v="caption" color="secondary">{w.profile ? SPECIALTY_LABEL[w.profile.specialty as keyof typeof SPECIALTY_LABEL] : ''} · ⭐ {w.profile?.ratingAvg ?? '—'}{w.activeWork ? ' · band' : ' · bo\'sh'}</Txt></View>
          </Pressable>
        ))}
        <Gap />
        <Button title="Buyurtmani yaratish" onPress={submit} loading={create.isPending} />
        <Gap h={30} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
