import React, { useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Gap, Txt } from '@/design/primitives';
import { Icon, IconName } from '@/design/ui';
import { useTheme } from '@/design/theme';
import type { ErpAction } from '@/core/erp';
import { ApiException } from '@/core/api';
import { useErpAction, useErpDetail } from '@/features/erp/api';
import { startErpTracking, stopErpTracking } from '@/core/erp-track';
import { openNavigation } from '@/core/navigate';
import { Chip, ListRow, ROW_ICON, SectionHead, statusLabel } from '@/features/erp/ui';
import { erpText } from '@/design/tokens';
import { useSession } from '@/core/session';
import { Appear, PressScale, stagger } from '@/design/motion';
import { FieldInput, firstMissing, initialValues, toPayload, visibleFields, type ItemRow, type Values } from '@/features/erp/form';

/**
 * Insof ERP hujjat kartochkasi — barcha bo'limlar uchun bitta ekran.
 * Maydonlar ham, tugmalar ham serverdan keladi (`/api/mobile/detail`), shuning uchun
 * yangi amal qo'shilsa ilovani qayta chiqarish shart emas.
 */
/** Tugma ikonkalari — amal nimani anglatishini bir qarashda ko'rsatadi. */
const ACTION_ICON: Record<string, IconName> = {
  'order.confirm': 'checkmark-circle',
  'order.unblock': 'lock-open',
  'order.cancel': 'close-circle',
  'trip.loaded': 'cube',
  'trip.onroad': 'navigate',
  'trip.delivered': 'flag',
  'trip.cancel': 'close-circle',
  'trip.eco': 'phone-portrait',
  'invoice.pay': 'cash',
};

export default function ErpDetail() {
  const { key, id } = useLocalSearchParams<{ key: string; id: string }>();
  const { c } = useTheme();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const role = useSession((s) => s.erp?.role ?? 'DIRECTOR');
  const { data, isLoading, error, refetch, isRefetching } = useErpDetail(key!, id!);
  const run = useErpAction();
  const [form, setForm] = useState<{ action: ErpAction; values: Values } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  React.useEffect(() => {
    if (data) nav.setOptions({ title: data.title });
  }, [data, nav]);

  // Forma ochiq bo'lsa apparat "orqaga" tugmasi ekrandan chiqmasin — avval formani yopsin.
  React.useEffect(() => {
    if (!form) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setForm(null); return true; });
    return () => sub.remove();
  }, [form]);

  /**
   * Amaldan keyingi ish — serverdagi `effect` aytadi (kuzatuv, navigatsiya).
   * Tartib muhim: navigatsiya ilovaga o'tib ketadi, shuning uchun kuzatuv avval yoqiladi.
   */
  const applyEffect = async (a: ErpAction): Promise<string | null> => {
    const e = a.effect;
    if (!e) return null;
    let note: string | null = null;
    if (e.track === 'start') {
      const bg = await startErpTracking(id!);
      if (!bg) note = 'Joylashuv fon rejimida ruxsat etilmagan — ilova yopilsa iz uzilib qoladi.';
    }
    if (e.track === 'stop') await stopErpTracking();
    if (e.navigate && !(await openNavigation(e.navigate.lat, e.navigate.lng, e.navigate.label))) {
      note = note ?? 'Navigatsiya ilovasi topilmadi.';
    }
    return note;
  };

  const execute = async (a: ErpAction, payload?: Record<string, unknown>) => {
    try {
      const r = await run.mutateAsync({ action: a.id, id: id!, payload });
      setForm(null);
      const note = await applyEffect(a);
      Alert.alert('Bajarildi', note ? `${r.message}\n\n${note}` : r.message);
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : 'Tarmoq xatosi';
      if (form) setFormError(msg); else Alert.alert('Bajarilmadi', msg);
    }
  };

  const press = (a: ErpAction) => {
    setFormError(null);
    if (a.form?.length) {
      setForm({ action: a, values: initialValues(a.form) });
      return;
    }
    if (a.confirm) {
      Alert.alert(a.label, a.confirm, [
        { text: 'Bekor', style: 'cancel' },
        { text: a.label, style: a.tone === 'danger' ? 'destructive' : 'default', onPress: () => void execute(a) },
      ]);
      return;
    }
    void execute(a);
  };

  if (isLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.brandPrimary} /></View>;
  if (error || !data) return <EmptyState title="Kartochka ochilmadi" hint="Internetni tekshiring" />;

  const tone = (t?: string) => (t ? { brand: c.brandPrimary, success: c.success, warning: c.warning, danger: c.danger, info: c.info }[t] ?? c.textPrimary : c.textPrimary);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brandPrimary} />}
      >
        <Appear>
          <View style={{ backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Txt style={{ ...erpText.titleLg, color: c.textPrimary }}>{data.title}</Txt>
                {data.subtitle ? <Txt style={{ fontSize: 13.5, color: c.textSecondary, marginTop: 3 }}>{data.subtitle}</Txt> : null}
              </View>
              {data.status ? <Chip label={statusLabel(data.status)} tone={data.status === 'CANCELLED' ? 'danger' : undefined} /> : null}
            </View>
          </View>
        </Appear>
        <Gap h={12} />

        <Appear delay={60}>
          <View style={{ backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 14, overflow: 'hidden' }}>
            {data.fields.map((f, i) => (
              <View key={f.label} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i === data.fields.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
                <Txt style={{ fontSize: 13, color: c.textSecondary, width: 128 }}>{f.label}</Txt>
                <Txt style={{ ...erpText.rowTitle, flex: 1, color: tone(f.tone) }}>{f.value}</Txt>
              </View>
            ))}
          </View>
        </Appear>

        {data.sections.map((s, i) => (
          <Appear key={s.title} delay={stagger(i + 2, 70)} style={{ marginTop: 22 }}>
            <SectionHead title={s.title} />
            {s.rows.length === 0 ? (
              <View style={{ backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 22, alignItems: 'center' }}>
                <Txt style={{ fontSize: 13, color: c.textSecondary }}>{s.empty}</Txt>
              </View>
            ) : s.rows.map((r, j) => (
              <ListRow
                key={r.id}
                row={r}
                index={j}
                role={role}
                icon={ROW_ICON[s.target ?? ''] ?? 'ellipse-outline'}
                onPress={s.target ? () => router.push(`/erp/${s.target}/${r.id}` as never) : undefined}
              />
            ))}
          </Appear>
        ))}

        {data.actions.length ? (
          <Appear delay={stagger(data.sections.length + 2, 70)} style={{ marginTop: 26 }}>
            <SectionHead title="Amallar" />
            {data.actions.map((a) => {
              const col = a.tone === 'danger' ? c.danger : a.tone === 'success' ? c.success : a.tone === 'warning' ? c.warning : c.brandPrimary;
              const soft = a.tone === 'danger' || a.tone === 'warning';
              return (
                <View key={a.id} style={{ marginBottom: 10 }}>
                  <PressScale onPress={() => press(a)} disabled={run.isPending}>
                    <View style={{ height: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: soft ? col + '14' : col, borderWidth: soft ? 1 : 0, borderColor: col + '33', opacity: run.isPending ? 0.6 : 1 }}>
                      <Icon name={ACTION_ICON[a.id] ?? 'arrow-forward'} size={18} color={soft ? col : '#FFFFFF'} />
                      <Txt style={{ ...erpText.button, marginLeft: 8, color: soft ? col : '#FFFFFF' }}>{a.label}</Txt>
                    </View>
                  </PressScale>
                </View>
              );
            })}
          </Appear>
        ) : null}
      </ScrollView>

      {/* Ma'lumot so'raydigan amallar — qabul qilgan kishi, to'lov summasi va h.k.
          React Native'ning `<Modal>` i yangi arxitekturada (Fabric) ekranga chiqmaydi:
          holat o'zgaradi, lekin oyna ko'rinmaydi va "Yetkazdim" bosilmagandek tuyuladi.
          Shuning uchun oddiy qatlam — ekran ichida, native oynasiz. */}
      {form ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }]}>
          {/* Fon bosilsa yopiladi */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setForm(null)} />
          <View style={{ backgroundColor: c.bgCanvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 16, maxHeight: '88%' }}>
            {/* Sarlavha doim ko'rinib turadi, maydonlar ko'p bo'lsa ichi aylanadi */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 }}>
              <Txt v="heading" style={{ flex: 1 }}>{form?.action.label}</Txt>
              <Pressable onPress={() => setForm(null)} hitSlop={10}><Icon name="close" size={24} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
              {form ? visibleFields(form.action.form ?? [], form.values).map((f) => (
                <FieldInput
                  key={f.name}
                  field={f}
                  values={form.values}
                  onChange={(name: string, v: string | ItemRow[]) => setForm((s) => (s ? { ...s, values: { ...s.values, [name]: v } } : s))}
                />
              )) : null}
              {formError ? <Txt v="callout" color="danger" style={{ marginTop: 8 }}>{formError}</Txt> : null}
            </ScrollView>
            <View style={{ paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: c.border }}>
              <Button
                title={form?.action.label ?? 'Saqlash'}
                loading={run.isPending}
                onPress={() => {
                  if (!form) return;
                  const missing = firstMissing(form.action.form ?? [], form.values);
                  if (missing) { setFormError(missing); return; }
                  void execute(form.action, toPayload(form.action.form ?? [], form.values));
                }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}
