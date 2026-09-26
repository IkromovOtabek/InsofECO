import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Gap, Txt } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { ApiException } from '@/core/api';
import { useErpCreate, useErpForm } from '@/features/erp/api';
import { FieldInput, firstMissing, initialValues, toPayload, visibleFields, type ItemRow, type Values } from '@/features/erp/form';

/**
 * Yangi hujjat (zayavka / reys). Forma tavsifi serverdan keladi — tanlov ro'yxatlari
 * (mijozlar, markalar, mikserlar, haydovchilar) har doim dolzarb bo'ladi.
 * Qoidalarni server tekshiradi: qora ro'yxat, zayavka qoldig'i, mikser sig'imi.
 */
export default function ErpNew() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { c } = useTheme();
  const router = useRouter();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { data, isLoading, error } = useErpForm(key!);
  const create = useErpCreate();
  const [values, setValues] = useState<Values>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Forma bir marta to'ldiriladi: keshdan qayta kelganda foydalanuvchi kiritgani yo'qolmasin
  const seeded = React.useRef(false);
  useEffect(() => {
    if (!data) return;
    nav.setOptions({ title: data.title });
    if (seeded.current) return;
    seeded.current = true;
    setValues(initialValues(data.fields));
  }, [data, nav]);

  const setValue = (name: string, v: string | ItemRow[]) => {
    setFormError(null);
    setValues((s) => ({ ...s, [name]: v }));
  };

  const submit = async () => {
    if (!data) return;
    const missing = firstMissing(data.fields, values);
    if (missing) { setFormError(missing); return; }
    try {
      const r = await create.mutateAsync({ key: data.key, payload: toPayload(data.fields, values) });
      Alert.alert('Ochildi', r.message, [{ text: 'Kartochkani ochish', onPress: () => router.replace(`/erp/${r.key}/${r.id}` as never) }]);
    } catch (e) {
      setFormError(e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring');
    }
  };

  if (isLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.brand} /></View>;
  if (error || !data) return <EmptyState title="Forma ochilmadi" hint={error instanceof ApiException ? error.message : 'Internetni tekshiring'} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: space.pageX, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        {visibleFields(data.fields, values).map((f) => (
          <FieldInput key={f.name} field={f} values={values} onChange={setValue} />
        ))}
        {formError ? <Txt v="bodySm" color="danger">{formError}</Txt> : null}
        <Gap h={space.md} />
      </ScrollView>
      <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.md, borderTopWidth: size.hairline, borderTopColor: c.borderDefault, backgroundColor: c.bgChrome }}>
        <Button title={data.submitLabel} loading={create.isPending} onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}
