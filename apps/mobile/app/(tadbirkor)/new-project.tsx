import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ProjectCreateSchema } from '@insof/shared';
import { Button, Field, Gap, SectionLabel } from '@/design/primitives';
import { useAction } from '@/features/eco/api';

export default function NewProject() {
  const router = useRouter();
  const [f, setF] = useState({ name: '', address: '', budget: '', clientName: '', deadline: '', description: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useAction<Record<string, unknown>, { id: string }>((body) => ({ path: '/projects', body }), ['projects', 'dash']);
  const submit = () => {
    const parsed = ProjectCreateSchema.safeParse({ name: f.name, address: f.address, budget: Number(f.budget.replace(/\s/g, '')), clientName: f.clientName || undefined, deadline: f.deadline || undefined, description: f.description || undefined, status: 'PLANNING' });
    if (!parsed.success) return Alert.alert('Tekshiring', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    create.mutate(parsed.data as never, { onSuccess: (p) => router.replace(`/project/${p.id}`), onError: (e) => Alert.alert('Xato', e.message) });
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <SectionLabel>Asosiy</SectionLabel>
        <Field value={f.name} onChangeText={set('name')} placeholder="Loyiha nomi (masalan, Toshkent Residence)" autoFocus />
        <Field value={f.address} onChangeText={set('address')} placeholder="Manzil" />
        <Field value={f.clientName} onChangeText={set('clientName')} placeholder="Buyurtmachi (ixtiyoriy)" />
        <SectionLabel>Byudjet va muddat</SectionLabel>
        <Field value={f.budget} onChangeText={set('budget')} placeholder="Byudjet, so'm" keyboardType="number-pad" />
        <Field value={f.deadline} onChangeText={set('deadline')} placeholder="Muddat (YYYY-MM-DD)" />
        <Field value={f.description} onChangeText={set('description')} placeholder="Qisqacha tavsif" multiline style={{ height: 90, paddingTop: 12 }} />
        <Gap />
        <Button title="Loyihani yaratish" onPress={submit} loading={create.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
