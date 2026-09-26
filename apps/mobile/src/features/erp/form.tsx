import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { Button, Card, IconButton, Input, Label, Select, Txt, type SelectOption } from '@/design/primitives';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import type { ErpFormField, ErpFormOption } from '@/core/erp';

/**
 * Serverdan kelgan forma tavsifini chizadigan qism.
 *
 * Bitta joyda: kartochkadagi amal oynasi ham (masalan "To'lov qabul qilish"),
 * "Yangi zayavka / Yangi reys" ekrani ham shu komponentlarni ishlatadi.
 * Maydon turlari: text, number, date, time, select, switch, items (takrorlanuvchi qatorlar).
 */
export type Values = Record<string, string | ItemRow[]>;
export type ItemRow = Record<string, string>;

const str = (v: string | ItemRow[] | undefined) => (typeof v === 'string' ? v : '');

/** Boshlang'ich qiymatlar: serverdagi `value`, `items` uchun bitta bo'sh qator. */
export function initialValues(fields: ErpFormField[]): Values {
  const v: Values = {};
  for (const f of fields) v[f.name] = f.type === 'items' ? [emptyRow(f)] : (f.value ?? '');
  return v;
}

const emptyRow = (f: ErpFormField): ItemRow => Object.fromEntries((f.columns ?? []).map((c) => [c.name, c.value ?? '']));

/** `showIf` shartiga ko'ra ko'rinadigan maydonlar. */
export const visibleFields = (fields: ErpFormField[], values: Values) =>
  fields.filter((f) => !f.showIf || str(values[f.showIf.field]) === f.showIf.equals);

/** Birinchi to'ldirilmagan majburiy maydon — bo'lmasa null. */
export function firstMissing(fields: ErpFormField[], values: Values): string | null {
  for (const f of visibleFields(fields, values)) {
    if (!f.required) continue;
    if (f.type === 'items') {
      const rows = (values[f.name] as ItemRow[]) ?? [];
      const filled = rows.filter((r) => (f.columns ?? []).some((c) => r[c.name]?.trim()));
      if (filled.length === 0) return `${f.label}: kamida bitta qator kerak`;
      for (const r of filled) {
        const miss = (f.columns ?? []).find((c) => c.required && !r[c.name]?.trim());
        if (miss) return `${f.label}: ${miss.label} to'ldirilmagan`;
      }
      continue;
    }
    if (!str(values[f.name]).trim()) return `${f.label} to'ldirilmagan`;
  }
  return null;
}

/** Serverga yuboriladigan ko'rinish: ko'rinmaydigan maydonlar tushib qoladi. */
export function toPayload(fields: ErpFormField[], values: Values): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of visibleFields(fields, values)) {
    if (f.type === 'items') {
      out[f.name] = ((values[f.name] as ItemRow[]) ?? []).filter((r) => (f.columns ?? []).some((c) => r[c.name]?.trim()));
    } else if (f.type === 'switch') {
      out[f.name] = str(values[f.name]) === 'true';
    } else {
      const v = str(values[f.name]).trim();
      if (v) out[f.name] = v;
    }
  }
  return out;
}

// ───────────────────────── Bitta maydon ─────────────────────────

export function FieldInput({ field, values, onChange }: { field: ErpFormField; values: Values; onChange: (name: string, v: string | ItemRow[]) => void }) {
  const { c } = useTheme();
  const value = str(values[field.name]);

  // Input/Select o'z pastki bo'shlig'ini o'zi qo'yadi; qolgan turlar Label + tana + izoh sifatida chiziladi
  switch (field.type) {
    case 'select':
      return (
        <View>
          <SelectField field={field} value={value} onChange={(v, o) => { onChange(field.name, v); autofill(field, o, values, onChange); }} />
          {field.hint ? <Txt v="caption" style={{ marginTop: -space.md, marginBottom: space.lg }}>{field.hint}</Txt> : null}
        </View>
      );
    case 'text':
    case 'number':
      return (
        <Input
          label={field.label}
          required={field.required}
          hint={field.hint}
          value={value}
          onChangeText={(v: string) => onChange(field.name, v)}
          placeholder={field.placeholder}
          keyboardType={field.type === 'number' ? 'numeric' : 'default'}
          autoCapitalize={field.type === 'number' ? 'none' : 'sentences'}
          autoCorrect={false}
        />
      );
    default:
      break;
  }

  const body = () => {
    switch (field.type) {
      case 'switch': return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: size.touch, gap: space.md }}>
          <Txt v="bodyStrong" style={{ flex: 1 }}>{field.label}</Txt>
          <Switch value={value === 'true'} onValueChange={(v) => onChange(field.name, String(v))} trackColor={{ true: c.brand }} accessibilityLabel={field.label} />
        </View>
      );
      case 'date': return <DateInput value={value} onChange={(v) => onChange(field.name, v)} />;
      case 'time': return <TimeInput value={value} onChange={(v) => onChange(field.name, v)} />;
      case 'items': return <ItemsInput field={field} rows={(values[field.name] as ItemRow[]) ?? []} onChange={(rows) => onChange(field.name, rows)} />;
      default: return null;
    }
  };

  return (
    <View style={{ marginBottom: space.lg }}>
      {field.type === 'switch' ? null : <Label required={field.required}>{field.label}</Label>}
      {body()}
      {field.hint ? <Txt v="caption" style={{ marginTop: space.xs }}>{field.hint}</Txt> : null}
    </View>
  );
}

/** Tanlangan variant boshqa maydonni to'ldirsa (masalan marka → narx). */
function autofill(field: ErpFormField, option: ErpFormOption | undefined, values: Values, onChange: (n: string, v: string) => void) {
  if (!option?.extra) return;
  for (const [k, v] of Object.entries(option.extra)) {
    if (!str(values[k]).trim()) onChange(k, v);
  }
}

// ───────────────────────── Turlar ─────────────────────────

/** Serverdagi variant — umumiy `Select` uchun `extra` (avto-to'ldirish) bilan. */
type FormOption = SelectOption & Pick<ErpFormOption, 'extra'>;

/**
 * Umumiy `Select` ustidagi yupqa qatlam: variant tanlanganda `extra`si bilan qaytaradi —
 * `Select` faqat {value,label} biladi, marka → narx to'ldirish uchun asl variant kerak.
 */
function SelectField({ field, value, onChange, compact }: { field: ErpFormField; value: string; onChange: (v: string, o?: ErpFormOption) => void; compact?: boolean }) {
  const all: FormOption[] = field.options ?? [];
  return (
    <Select
      label={field.label}
      required={field.required}
      compact={compact}
      value={value || null}
      options={all}
      onChange={(v) => onChange(v, all.find((o) => o.value === v))}
    />
  );
}

/** Tanlangan qiymat ekrandan tashqarida qolmasin — ochilganda unga suriladi. */
function useScrollToSelected(index: number, itemWidth: number) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    if (index <= 1) return;
    const t = setTimeout(() => ref.current?.scrollTo({ x: Math.max(0, (index - 1) * itemWidth), animated: false }), 60);
    return () => clearTimeout(t);
    // faqat birinchi chizilganda: keyin foydalanuvchi o'zi suradi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

/** Gorizontal tanlov chipi (sana/soat) — tanlangani brend fonida, matni to'q. */
function ChoiceChip({ on, onPress, label, children }: { on: boolean; onPress: () => void; label: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label}
      android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [
        { minHeight: size.touch, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.sm, borderWidth: size.hairline, borderColor: on ? c.brand : c.borderDefault, backgroundColor: on ? c.brandSoft : c.bgSurface, alignItems: 'center', justifyContent: 'center' },
        pressed && !on && { backgroundColor: c.bgMuted },
      ]}
    >
      {children}
    </Pressable>
  );
}

const DAY_NAMES = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Sana — yaqin 14 kun. Beton zayavkasi deyarli doim shu oraliqda. */
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);
  const ref = useScrollToSelected(days.findIndex((d) => ymd(d) === value), 70);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: 2 }}>
      {days.map((d, i) => {
        const v = ymd(d); const on = v === value;
        const day = i === 0 ? 'Bugun' : i === 1 ? 'Ertaga' : DAY_NAMES[d.getDay()];
        const date = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
        return (
          <ChoiceChip key={v} on={on} onPress={() => onChange(v)} label={`${day} ${date}`}>
            <Txt v="caption" color={on ? 'brand' : 'muted'}>{day}</Txt>
            <Txt v="bodyStrong" color={on ? 'brand' : 'strong'}>{date}</Txt>
          </ChoiceChip>
        );
      })}
    </ScrollView>
  );
}

/** Soat — 06:00 dan 20:00 gacha yarim soatlik qadam. */
function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const slots = useMemo(() => { const out: string[] = []; for (let h = 6; h <= 20; h++) { out.push(`${String(h).padStart(2, '0')}:00`); if (h < 20) out.push(`${String(h).padStart(2, '0')}:30`); } return out; }, []);
  const ref = useScrollToSelected(slots.indexOf(value), 82);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: 2 }}>
      {slots.map((t) => {
        const on = t === value;
        return (
          <ChoiceChip key={t} on={on} onPress={() => onChange(t)} label={t}>
            <Txt v="bodyStrong" color={on ? 'brand' : 'strong'}>{t}</Txt>
          </ChoiceChip>
        );
      })}
    </ScrollView>
  );
}

/** Takrorlanuvchi qatorlar — zayavka mahsulotlari. */
function ItemsInput({ field, rows, onChange }: { field: ErpFormField; rows: ItemRow[]; onChange: (rows: ItemRow[]) => void }) {
  const cols = field.columns ?? [];
  const set = (i: number, name: string, v: string) => onChange(rows.map((r, x) => (x === i ? { ...r, [name]: v } : r)));

  return (
    <View style={{ gap: space.md }}>
      {rows.map((row, i) => (
        <Card key={i}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm, minHeight: size.touch - space.sm }}>
            <Txt v="label" style={{ flex: 1 }}>{i + 1}-qator</Txt>
            {rows.length > 1 ? (
              <IconButton icon="trash" label="Qatorni o'chirish" tone="danger" size={size.touch - space.sm} onPress={() => onChange(rows.filter((_, x) => x !== i))} />
            ) : null}
          </View>
          {cols.map((col) => (
            col.type === 'select'
              ? <SelectField key={col.name} field={col} value={row[col.name] ?? ''} compact onChange={(v, o) => {
                  const next = { ...row, [col.name]: v };
                  // Marka tanlansa narx avtomatik to'ladi (bo'sh bo'lsa)
                  if (o?.extra) for (const [k, ev] of Object.entries(o.extra)) if (!next[k]?.trim()) next[k] = ev;
                  onChange(rows.map((r, x) => (x === i ? next : r)));
                }} />
              : <Input
                  key={col.name}
                  label={col.label}
                  required={col.required}
                  value={row[col.name] ?? ''}
                  onChangeText={(v: string) => set(i, col.name, v)}
                  placeholder={col.placeholder}
                  keyboardType={col.type === 'number' ? 'numeric' : 'default'}
                />
          ))}
        </Card>
      ))}
      <Button variant="secondary" icon="plus" title="Yana qator" onPress={() => onChange([...rows, emptyRow(field)])} />
    </View>
  );
}
