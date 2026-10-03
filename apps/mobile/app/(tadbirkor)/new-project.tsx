import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ProjectCreateSchema } from '@insof/shared';
import { ChipGroup, StickyActionBar } from '@/design/blocks';
import { Card, Gap, Input, Screen, Txt, fmtDateFull } from '@/design/primitives';
import { toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space, toneColors } from '@/design/tokens';
import { useAction } from '@/features/eco/api';

const pad2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addMonths = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d; };
type DlKey = 'none' | 'm1' | 'm3' | 'm6' | 'y1' | 'custom';
const DL_MONTHS: Partial<Record<DlKey, number>> = { m1: 1, m3: 3, m6: 6, y1: 12 };

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

/** Yangi loyiha: 1) asosiy ma'lumot → 2) byudjet va muddat (tayyor muddat chiplari yoki aniq sana) → 3) tavsif. */
export default function NewProject() {
  const router = useRouter();
  const [f, setF] = useState({ name: '', address: '', budget: '', clientName: '', deadline: '', description: '' });
  const [dl, setDl] = useState<DlKey>('none');
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const create = useAction<Record<string, unknown>, { id: string }>((body) => ({ path: '/projects', body }), ['projects', 'dash']);
  const presets = useMemo(() => Object.fromEntries(Object.entries(DL_MONTHS).map(([k, m]) => [k, ymd(addMonths(m!))])) as Partial<Record<DlKey, string>>, []);
  const pickDl = (k: DlKey) => { setDl(k); setF((s) => ({ ...s, deadline: k === 'none' ? '' : k === 'custom' ? s.deadline : presets[k] ?? '' })); };
  const submit = () => {
    const parsed = ProjectCreateSchema.safeParse({ name: f.name, address: f.address, budget: Number(f.budget.replace(/\s/g, '')), clientName: f.clientName || undefined, deadline: f.deadline || undefined, description: f.description || undefined, status: 'PLANNING' });
    if (!parsed.success) return toast.error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'), 'Tekshiring');
    create.mutate(parsed.data as never, { onSuccess: (p) => router.replace(`/project/${p.id}`), onError: (e) => toast.error(e.message, 'Xato') });
  };
  const step1 = f.name.trim().length >= 2 && f.address.trim().length >= 3;
  const budgetOk = f.budget.trim() !== '' && Number(f.budget.replace(/\s/g, '')) >= 0;
  const missing = f.name.trim().length < 2 ? 'Loyiha nomini kiriting' : f.address.trim().length < 3 ? 'Manzilni kiriting' : !budgetOk ? 'Byudjetni kiriting' : undefined;
  const dlValid = f.deadline && !Number.isNaN(new Date(f.deadline).getTime());

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.pageX, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
          <Card>
            <Step n={1} title="Asosiy" hint="Nomi, manzili va buyurtmachisi" done={step1} />
            <Input label="Loyiha nomi" required value={f.name} onChangeText={set('name')} placeholder="Masalan, Toshkent Residence" autoFocus />
            <Input label="Manzil" required value={f.address} onChangeText={set('address')} placeholder="Manzil" left="map-pin" />
            <Input label="Buyurtmachi" value={f.clientName} onChangeText={set('clientName')} placeholder="Ixtiyoriy" left="user" containerStyle={{ marginBottom: 0 }} />
          </Card>

          <Gap h={space.grid} />
          <Card>
            <Step n={2} title="Byudjet va muddat" hint={dlValid ? `Muddat: ${fmtDateFull(f.deadline)}` : 'Muddat ixtiyoriy'} done={budgetOk} />
            <Input label="Byudjet" required value={f.budget} onChangeText={set('budget')} placeholder="Byudjet, so'm" keyboardType="number-pad" mono left="wallet" />
            <Txt v="overline" style={{ marginBottom: space.sm }}>Muddat</Txt>
            <ChipGroup<DlKey>
              items={[{ key: 'none', label: 'Muddatsiz' }, { key: 'm1', label: '1 oy' }, { key: 'm3', label: '3 oy' }, { key: 'm6', label: '6 oy' }, { key: 'y1', label: '1 yil' }, { key: 'custom', label: 'Aniq sana' }]}
              value={dl} onChange={pickDl}
            />
            {dl === 'custom' ? (
              <Input value={f.deadline} onChangeText={set('deadline')} placeholder="YYYY-MM-DD" mono left="calendar-days" keyboardType="numbers-and-punctuation" hint="Masalan: 2027-03-31" containerStyle={{ marginTop: space.md, marginBottom: 0 }} />
            ) : null}
          </Card>

          <Gap h={space.grid} />
          <Card>
            <Step n={3} title="Tavsif" hint="Ixtiyoriy" done={!!f.description.trim()} />
            <Input value={f.description} onChangeText={set('description')} placeholder="Qisqacha tavsif" multiline containerStyle={{ marginBottom: 0 }} style={{ minHeight: space.x12 + space.xxxl, paddingTop: space.md, textAlignVertical: 'top' }} />
          </Card>
        </ScrollView>
        <StickyActionBar primary={{ title: 'Loyihani yaratish', icon: 'check', onPress: submit, loading: create.isPending, disabled: !!missing, disabledReason: missing }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
