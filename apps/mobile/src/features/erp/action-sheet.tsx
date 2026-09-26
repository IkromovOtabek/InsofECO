import React, { useState } from 'react';
import { Button, Txt } from '@/design/primitives';
import { Sheet } from '@/design/ui';
import { space } from '@/design/tokens';
import type { ErpAction } from '@/core/erp';
import { FieldInput, firstMissing, initialValues, toPayload, visibleFields, type ItemRow, type Values } from '@/features/erp/form';

/**
 * Ma'lumot so'raydigan amal oynasi — qabul qilgan kishi, to'lov summasi va h.k.
 *
 * Kartochka ekrani ham, marshrut ekrani ham shuni ishlatadi: "Yetkazdim" ikkala joyda
 * bir xil maydonlarni so'rashi kerak, aks holda ikkita forma ikki tomonga o'sib ketardi.
 *
 * Umumiy `Sheet` ustida: u native `<Modal>`siz, ekran ichida chiziladi (Fabric'da native
 * oyna ko'rinmay qolardi), apparat "orqaga" tugmasini ham o'zi ushlaydi.
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
  const [miss, setMiss] = useState<string | null>(null);

  const change = (name: string, v: string | ItemRow[]) => setValues((s) => ({ ...s, [name]: v }));

  return (
    <Sheet
      open
      onClose={onClose}
      title={action.label}
      footer={(
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
      )}
    >
      {visibleFields(fields, values).map((f) => (
        <FieldInput key={f.name} field={f} values={values} onChange={change} />
      ))}
      {error || miss ? <Txt v="bodySm" color="danger" style={{ marginBottom: space.sm }}>{error ?? miss}</Txt> : null}
    </Sheet>
  );
}
