import React, { useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Txt } from '@/design/primitives';
import { Icon } from '@/design/ui';
import { useTheme } from '@/design/theme';
import type { ErpAction } from '@/core/erp';
import { FieldInput, firstMissing, initialValues, toPayload, visibleFields, type ItemRow, type Values } from '@/features/erp/form';

/**
 * Ma'lumot so'raydigan amal oynasi — qabul qilgan kishi, to'lov summasi va h.k.
 *
 * Kartochka ekrani ham, marshrut ekrani ham shuni ishlatadi: "Yetkazdim" ikkala joyda
 * bir xil maydonlarni so'rashi kerak, aks holda ikkita forma ikki tomonga o'sib ketardi.
 *
 * React Native'ning `<Modal>` i yangi arxitekturada (Fabric) ekranga chiqmaydi:
 * holat o'zgaradi, lekin oyna ko'rinmaydi va tugma bosilmagandek tuyuladi.
 * Shuning uchun oddiy qatlam — ekran ichida, native oynasiz.
 */
export function ActionSheet({ action, loading, error, onClose, onSubmit }: {
  action: ErpAction;
  loading: boolean;
  /** Serverdan kelgan xato. To'ldirilmagan maydon haqidagi ogohlantirish ichkarida. */
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const fields = action.form ?? [];
  const [values, setValues] = useState<Values>(() => initialValues(fields));
  const [miss, setMiss] = useState<string | null>(null);

  // Apparat "orqaga" tugmasi ekrandan chiqmasin — avval formani yopsin.
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose]);

  const change = (name: string, v: string | ItemRow[]) => setValues((s) => ({ ...s, [name]: v }));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }]}>
      {/* Fon bosilsa yopiladi */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={{ backgroundColor: c.bgCanvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 16, maxHeight: '88%' }}>
        {/* Sarlavha doim ko'rinib turadi, maydonlar ko'p bo'lsa ichi aylanadi */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 }}>
          <Txt v="heading" style={{ flex: 1 }}>{action.label}</Txt>
          <Pressable onPress={onClose} hitSlop={10}><Icon name="close" size={24} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
          {visibleFields(fields, values).map((f) => (
            <FieldInput key={f.name} field={f} values={values} onChange={change} />
          ))}
          {error || miss ? <Txt v="callout" color="danger" style={{ marginTop: 8 }}>{error ?? miss}</Txt> : null}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: c.border }}>
          <Button
            title={action.label}
            loading={loading}
            onPress={() => {
              const m = firstMissing(fields, values);
              setMiss(m);
              if (m) return;
              onSubmit(toPayload(fields, values));
            }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
