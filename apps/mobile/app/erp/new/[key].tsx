import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { HeaderHeightContext } from '@react-navigation/elements';
import { Callout, EmptyState, Txt } from '@/design/primitives';
import { PageHeader, StickyActionBar } from '@/design/blocks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/design/icons';
import { result } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { Appear, haptic } from '@/design/motion';
import { ApiException } from '@/core/api';
import { useErpCreate, useErpForm } from '@/features/erp/api';
import { FieldInput, clearError, initialValues, toPayload, validate, visibleFields, withChange, type FieldErrors, type ItemRow, type Values } from '@/features/erp/form';
import { Loader } from '@/design/loader';

/**
 * Yangi hujjat (zayavka / reys). Forma tavsifi serverdan keladi — tanlov ro'yxatlari
 * (mijozlar, markalar, mikserlar, haydovchilar) har doim dolzarb bo'ladi.
 * Qoidalarni server tekshiradi: qora ro'yxat, zayavka qoldig'i, mikser sig'imi.
 *
 * To'ldirilmagan maydonlar joyida qizil bilan ajraladi, tepada "N ta maydon" plashkasi chiqadi
 * va forma birinchi xatoli maydonga suriladi. Server rad etsa — sababi tepada (alohida oynasiz).
 */
export default function ErpNew() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { c } = useTheme();
  const router = useRouter();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const headerH = React.useContext(HeaderHeightContext) ?? 0;
  const { data, isLoading, error } = useErpForm(key!);
  const create = useErpCreate();
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  /** Har maydonning forma ichidagi Y joyi — birinchi xatoga surish uchun. */
  const pos = useRef<Record<string, number>>({});

  // Demo sarlavhasi (orqaga · nom) ekranning o'zida
  useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Forma bir marta to'ldiriladi: keshdan qayta kelganda foydalanuvchi kiritgani yo'qolmasin
  const seeded = React.useRef(false);
  useEffect(() => {
    if (!data) return;
    if (seeded.current) return;
    seeded.current = true;
    setValues(initialValues(data.fields));
  }, [data, nav]);

  const setValue = (name: string, v: string | ItemRow[]) => {
    setServerError(null);
    setErrors((e) => clearError(e, name));
    setValues((s) => (data ? withChange(data.fields, s, name, v) : { ...s, [name]: v }));
  };

  const visible = data ? visibleFields(data.fields, values) : [];
  const errorCount = visible.filter((f) => errors[f.name]).length;

  const toFirstError = (errs: FieldErrors = errors) => {
    const first = visible.find((f) => errs[f.name]);
    if (!first) return;
    scroll.current?.scrollTo({ y: Math.max(0, (pos.current[first.name] ?? 0) - space.xxl), animated: true });
  };

  const submit = async () => {
    if (!data) return;
    const errs = validate(data.fields, values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      haptic.warning();
      toFirstError(errs);
      return;
    }
    try {
      const r = await create.mutateAsync({ key: data.key, payload: toPayload(data.fields, values) });
      // Foydalanuvchi natijani o'qib ulgursin, kartochka shundan keyin ochiladi
      // Kassa yozuvlari "ochilmaydi" — saqlanadi
      result.success(['payments', 'cashflow', 'transfer'].includes(data.key) ? 'Saqlandi' : 'Ochildi', r.message, () => router.replace(`/erp/${r.key}/${r.id}` as never));
    } catch (e) {
      haptic.error();
      setServerError(e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring');
      scroll.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const header = <PageHeader title={data?.title ?? 'Yangi hujjat'} onBack={back} style={{ paddingTop: insets.top + space.sm }} />;
  if (isLoading) return <View style={{ flex: 1, backgroundColor: c.bgApp }}>{header}<Loader fill /></View>;
  if (error || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        {header}
        <EmptyState icon="cloud-off" title="Forma ochilmadi" hint={error instanceof ApiException ? error.message : 'Internetni tekshiring'} onRetry={back} retryLabel="Orqaga" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerH}>
      {header}
      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        {errorCount ? (
          <Appear from={-6} scale={1} style={{ marginBottom: space.lg }}>
            <Pressable
              onPress={() => toFirstError()}
              accessibilityRole="button" accessibilityLiveRegion="polite"
              accessibilityLabel={`${errorCount} ta maydon to'ldirilmagan. Birinchisiga o'tish`}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start', minHeight: size.touch - space.xs, paddingLeft: space.md, paddingRight: space.sm, borderRadius: radius.pill, backgroundColor: c.dangerBg }, pressed && { opacity: 0.8 }]}
            >
              <Icon name="circle-alert" tone="danger" size={size.iconSm} />
              <Txt v="label" color="danger">{errorCount} ta maydon to&apos;ldirilmagan</Txt>
              <Icon name="chevron-down" tone="danger" size={size.iconSm} />
            </Pressable>
          </Appear>
        ) : null}
        {serverError ? (
          <Appear from={-6} scale={1} style={{ marginBottom: space.lg }}>
            <Callout tone="danger">{serverError}</Callout>
          </Appear>
        ) : null}
        {visible.map((f) => (
          <View key={f.name} onLayout={(e) => { pos.current[f.name] = e.nativeEvent.layout.y; }}>
            <FieldInput field={f} values={values} onChange={setValue} errors={errors} />
          </View>
        ))}
      </ScrollView>
      <StickyActionBar primary={{ title: data.submitLabel, icon: 'check', loading: create.isPending, onPress: () => void submit() }} />
    </KeyboardAvoidingView>
  );
}
