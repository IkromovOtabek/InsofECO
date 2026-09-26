import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ProjectCreateSchema } from '@insof/shared';
import { Button, Gap, Input, Label, Screen } from '@/design/primitives';
import { toast } from '@/design/ui';
import { space } from '@/design/tokens';
import { useAction } from '@/features/eco/api';

export default function NewProject() {
  const router = useRouter();
  const [f, setF] = useState({ name: '', address: '', budget: '', clientName: '', deadline: '', description: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useAction<Record<string, unknown>, { id: string }>((body) => ({ path: '/projects', body }), ['projects', 'dash']);
  const submit = () => {
    const parsed = ProjectCreateSchema.safeParse({ name: f.name, address: f.address, budget: Number(f.budget.replace(/\s/g, '')), clientName: f.clientName || undefined, deadline: f.deadline || undefined, description: f.description || undefined, status: 'PLANNING' });
    if (!parsed.success) return toast.error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'), 'Tekshiring');
    create.mutate(parsed.data as never, { onSuccess: (p) => router.replace(`/project/${p.id}`), onError: (e) => toast.error(e.message, 'Xato') });
  };
  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.pageX }} keyboardShouldPersistTaps="handled">
          <Label>Asosiy</Label>
          <Input value={f.name} onChangeText={set('name')} placeholder="Loyiha nomi (masalan, Toshkent Residence)" autoFocus />
          <Input value={f.address} onChangeText={set('address')} placeholder="Manzil" left="map-pin" />
          <Input value={f.clientName} onChangeText={set('clientName')} placeholder="Buyurtmachi (ixtiyoriy)" />
          <Label>Byudjet va muddat</Label>
          <Input value={f.budget} onChangeText={set('budget')} placeholder="Byudjet, so'm" keyboardType="number-pad" mono />
          <Input value={f.deadline} onChangeText={set('deadline')} placeholder="Muddat (YYYY-MM-DD)" mono left="calendar-days" />
          <Input value={f.description} onChangeText={set('description')} placeholder="Qisqacha tavsif" multiline style={{ minHeight: space.x12 + space.xxxl, paddingTop: space.md, textAlignVertical: 'top' }} />
          <Gap />
          <Button title="Loyihani yaratish" size="lg" onPress={submit} loading={create.isPending} />
          <Gap h={space.xxxl} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
