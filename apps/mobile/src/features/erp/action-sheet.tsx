import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Callout, Txt } from '@/design/primitives';
import { Sheet } from '@/design/ui';
import { space } from '@/design/tokens';
import { Appear, haptic } from '@/design/motion';
import type { ErpAction } from '@/core/erp';
import { FieldInput, clearError, initialValues, toPayload, validate, visibleFields, withChange, type FieldErrors, type ItemRow, type Values } from '@/features/erp/form';

/**
 * Ma'lumot so'raydigan amal oynasi — qabul qilgan kishi, to'lov summasi va h.k.
 *
 * Kartochka ekrani ham, marshrut ekrani ham shuni ishlatadi: "Yetkazdim" ikkala joyda
 * bir xil maydonlarni so'rashi kerak, aks holda ikkita forma ikki tomonga o'sib ketardi.
 *
 * Umumiy `Sheet` ustida: u native `<Modal>`siz, ekran ichida chiziladi (Fabric'da native
 * oyna ko'rinmay qolardi), apparat "orqaga" tugmasini ham o'zi ushlaydi.
 * To'ldirilmagan maydon joyida qizil bilan ajraladi; server xatosi tepada yumshoq plashkada.
 */
export function ActionSheet({ action, loading, error, onClose, onSubmit }: {
  action: ErpAction;
  loading: boolean;
  /** Serverdan kelgan xato. To'ldirilmagan maydon haqidagi ogohlantirish ichkarida. */
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const fields = action.form ?? [];
  const [values, setValues] = useState<Values>(() => initialValues(fields));
  const [errors, setErrors] = useState<FieldErrors>({});

  const change = (name: string, v: string | ItemRow[]) => {
    setErrors((e) => clearError(e, name));
    setValues((s) => withChange(fields, s, name, v));
  };
  const visible = visibleFields(fields, values);
  const missCount = visible.filter((f) => errors[f.name]).length;
  const tone = action.tone === 'danger' ? 'danger' : action.tone === 'success' ? 'success' : action.tone === 'warning' ? 'secondary' : 'primary';

  return (
    <Sheet
      open
      onClose={onClose}
      title={action.label}
      footer={(
        <View style={{ gap: space.sm }}>
          {missCount ? <Txt v="caption" color="danger" align="center">{missCount} ta maydon to&apos;ldirilmagan</Txt> : null}
          <Button
            title={action.label}
            size="lg"
            loading={loading}
            variant={tone}
            onPress={() => {
              const errs = validate(fields, values);
              setErrors(errs);
              if (Object.keys(errs).length) { haptic.warning(); return; }
              onSubmit(toPayload(fields, values));
            }}
          />
        </View>
      )}
    >
      {error ? (
        <Appear from={-6} scale={1} style={{ marginBottom: space.lg }}>
          <Callout tone="danger">{error}</Callout>
        </Appear>
      ) : null}
      {visible.map((f) => (
        <FieldInput key={f.name} field={f} values={values} onChange={change} errors={errors} />
      ))}
    </Sheet>
  );
}
