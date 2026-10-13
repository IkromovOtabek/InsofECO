import React, { useCallback, useRef, useState } from 'react';
import { Button, Callout } from '@/design/primitives';
import { Sheet } from '@/design/ui';
import { space } from '@/design/tokens';
import { Appear, haptic } from '@/design/motion';
import { ApiException } from '@/core/api';
import type { ErpFormOption, ErpQuickCreate } from '@/core/erp';
import { useErpCreate } from '@/features/erp/api';
import { FieldInput, clearError, initialValues, toPayload, validate, visibleFields, withChange, type FieldErrors, type ItemRow, type QuickCreateFn, type Values } from '@/features/erp/form';

/**
 * Tanlov ichidan yangi yozuv qo'shish (`field.create`): masalan ta'minot so'rovida spravochnikda yo'q xomashyo.
 *
 * Ekran `quick` ni `QuickCreateContext` orqali formaga beradi va `sheet` ni ildizda chizadi. Saqlangach
 * ERP keshi yangilanadi (`useErpCreate`) — forma tanlovlari serverdan yangi yozuv bilan qayta keladi,
 * kiritilgan qiymatlar esa saqlanadi (forma bir marta to'ldiriladi).
 */
export function useQuickCreate(): { quick: QuickCreateFn; sheet: React.ReactNode } {
  const [spec, setSpec] = useState<ErpQuickCreate | null>(null);
  const resolver = useRef<((o: ErpFormOption | null) => void) | null>(null);
  const quick = useCallback<QuickCreateFn>((s) => new Promise((resolve) => {
    resolver.current?.(null); // oldingi varaq javobsiz yopilgan bo'lsa
    resolver.current = resolve;
    setSpec(s);
  }), []);
  const done = useCallback((o: ErpFormOption | null) => {
    resolver.current?.(o);
    resolver.current = null;
    setSpec(null);
  }, []);
  return { quick, sheet: spec ? <QuickCreateSheet key={spec.key} spec={spec} onDone={done} /> : null };
}

function QuickCreateSheet({ spec, onDone }: { spec: ErpQuickCreate; onDone: (o: ErpFormOption | null) => void }) {
  const create = useErpCreate();
  const [values, setValues] = useState<Values>(() => initialValues(spec.fields));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const change = (name: string, v: string | ItemRow[]) => {
    setServerError(null);
    setErrors((e) => clearError(e, name));
    setValues((s) => withChange(spec.fields, s, name, v));
  };

  const submit = async () => {
    const errs = validate(spec.fields, values);
    setErrors(errs);
    if (Object.keys(errs).length) { haptic.warning(); return; }
    const payload = toPayload(spec.fields, values);
    try {
      const r = await create.mutateAsync({ key: spec.key, payload });
      haptic.success();
      // Eski server `option` bermasa — id va kiritilgan nom bilan (forma qayta kelganda serverdagi yorliq chiqadi)
      onDone(r.option ?? { value: r.id, label: typeof payload.name === 'string' ? payload.name : r.message });
    } catch (e) {
      haptic.error();
      setServerError(e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring');
    }
  };

  return (
    <Sheet
      open
      onClose={() => onDone(null)}
      title={spec.label}
      footer={<Button title="Qo'shish va tanlash" icon="check" size="lg" loading={create.isPending} onPress={() => void submit()} />}
    >
      {serverError ? (
        <Appear from={-6} scale={1} style={{ marginBottom: space.lg }}>
          <Callout tone="danger">{serverError}</Callout>
        </Appear>
      ) : null}
      {visibleFields(spec.fields, values).map((f) => (
        <FieldInput key={f.name} field={f} values={values} onChange={change} errors={errors} />
      ))}
    </Sheet>
  );
}
