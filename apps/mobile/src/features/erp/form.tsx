import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { Card, Field, Gap, SectionLabel, Txt } from '@/design/primitives';
import { Icon } from '@/design/ui';
import { useTheme } from '@/design/theme';
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
  const label = field.required ? `${field.label} *` : field.label;

  const body = () => {
    switch (field.type) {
      case 'select': return <SelectInput field={field} value={value} onChange={(v, o) => { onChange(field.name, v); autofill(field, o, values, onChange); }} />;
      case 'switch': return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
          <Txt v="bodyStrong" style={{ flex: 1 }}>{field.label}</Txt>
          <Switch value={value === 'true'} onValueChange={(v) => onChange(field.name, String(v))} trackColor={{ true: c.brandPrimary }} />
        </View>
      );
      case 'date': return <DateInput value={value} onChange={(v) => onChange(field.name, v)} />;
      case 'time': return <TimeInput value={value} onChange={(v) => onChange(field.name, v)} />;
      case 'items': return <ItemsInput field={field} rows={(values[field.name] as ItemRow[]) ?? []} onChange={(rows) => onChange(field.name, rows)} />;
      default: return (
        <Field
          value={value}
          onChangeText={(v) => onChange(field.name, v)}
          placeholder={field.placeholder}
          keyboardType={field.type === 'number' ? 'numeric' : 'default'}
          autoCapitalize={field.type === 'number' ? 'none' : 'sentences'}
          autoCorrect={false}
        />
      );
    }
  };

  return (
    <View style={{ marginBottom: 6 }}>
      {field.type === 'switch' ? null : <SectionLabel>{label}</SectionLabel>}
      {body()}
      {field.hint ? <Txt v="caption" color="secondary" style={{ marginTop: 4 }}>{field.hint}</Txt> : null}
      <Gap h={8} />
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

function SelectInput({ field, value, onChange, compact }: { field: ErpFormField; value: string; onChange: (v: string, o?: ErpFormOption) => void; compact?: boolean }) {
  const { c, shape } = useTheme();
  const [q, setQ] = useState('');
  const all = field.options ?? [];
  const searchable = all.length > 8;
  // Uchtadan ko'p variant — yig'iladigan ro'yxat: forma cho'zilib ketmasin va
  // tanlanganini bir qarashda ko'rsatib tursin. Ikki-uchta bo'lsa hammasi ko'rinadi.
  const collapsible = all.length > 3 || compact;
  const [open, setOpen] = useState(false);
  const list = useMemo(() => (q.trim() ? all.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : all), [all, q]);
  const selected = all.find((o) => o.value === value);

  if (all.length === 0) return <Txt v="callout" color="secondary">Variant yo&apos;q</Txt>;

  if (collapsible) {
    return (
      <View>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: shape.input, borderWidth: 1, borderColor: open ? c.brandPrimary : c.border, backgroundColor: c.bgSurface }}
        >
          <Txt v="bodyStrong" style={{ flex: 1, color: selected ? c.textPrimary : c.textSecondary }} numberOfLines={1}>
            {selected?.label ?? 'Tanlang…'}
          </Txt>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} />
        </Pressable>
        {open ? (
          <View style={{ marginTop: 8 }}>
            {searchable ? <><Field value={q} onChangeText={setQ} placeholder="Qidirish…" autoCorrect={false} /><Gap h={8} /></> : null}
            <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {list.map((o) => <Option key={o.value} o={o} on={o.value === value} onPress={() => { onChange(o.value, o); setOpen(false); setQ(''); }} />)}
              {list.length === 0 ? <Txt v="callout" color="secondary" style={{ padding: 12 }}>Topilmadi</Txt> : null}
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  }

  return <View style={{ gap: 8 }}>{all.map((o) => <Option key={o.value} o={o} on={o.value === value} onPress={() => onChange(o.value, o)} />)}</View>;
}

function Option({ o, on, onPress }: { o: ErpFormOption; on: boolean; onPress: () => void }) {
  const { c, shape } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, borderRadius: shape.input, borderWidth: 1, borderColor: on ? c.brandPrimary : c.border, backgroundColor: on ? c.brandPrimary + '12' : c.bgSurface }}
    >
      <Icon name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? c.brandPrimary : c.textSecondary} />
      <Txt v="bodyStrong" style={{ marginLeft: 10, flex: 1 }}>{o.label}</Txt>
    </Pressable>
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

const DAY_NAMES = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Sana — yaqin 14 kun. Beton zayavkasi deyarli doim shu oraliqda. */
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { c, shape } = useTheme();
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);
  const ref = useScrollToSelected(days.findIndex((d) => ymd(d) === value), 70);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {days.map((d, i) => {
        const v = ymd(d); const on = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: shape.input, borderWidth: 1, borderColor: on ? c.brandPrimary : c.border, backgroundColor: on ? c.brandPrimary : c.bgSurface, alignItems: 'center', minWidth: 62 }}
          >
            <Txt v="caption" style={{ color: on ? c.textOnBrand : c.textSecondary }}>{i === 0 ? 'Bugun' : i === 1 ? 'Ertaga' : DAY_NAMES[d.getDay()]}</Txt>
            <Txt v="bodyStrong" style={{ color: on ? c.textOnBrand : c.textPrimary }}>{d.getDate()}.{String(d.getMonth() + 1).padStart(2, '0')}</Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Soat — 06:00 dan 20:00 gacha yarim soatlik qadam. */
function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { c, shape } = useTheme();
  const slots = useMemo(() => { const out: string[] = []; for (let h = 6; h <= 20; h++) { out.push(`${String(h).padStart(2, '0')}:00`); if (h < 20) out.push(`${String(h).padStart(2, '0')}:30`); } return out; }, []);
  const ref = useScrollToSelected(slots.indexOf(value), 82);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {slots.map((t) => {
        const on = t === value;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            style={{ paddingHorizontal: 14, paddingVertical: 11, borderRadius: shape.input, borderWidth: 1, borderColor: on ? c.brandPrimary : c.border, backgroundColor: on ? c.brandPrimary : c.bgSurface }}
          >
            <Txt v="bodyStrong" style={{ color: on ? c.textOnBrand : c.textPrimary }}>{t}</Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Takrorlanuvchi qatorlar — zayavka mahsulotlari. */
function ItemsInput({ field, rows, onChange }: { field: ErpFormField; rows: ItemRow[]; onChange: (rows: ItemRow[]) => void }) {
  const { c } = useTheme();
  const cols = field.columns ?? [];
  const set = (i: number, name: string, v: string) => onChange(rows.map((r, x) => (x === i ? { ...r, [name]: v } : r)));

  return (
    <View>
      {rows.map((row, i) => (
        <Card key={i} style={{ padding: 14, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Txt v="caption" color="secondary" style={{ flex: 1 }}>{i + 1}-qator</Txt>
            {rows.length > 1 ? (
              <Pressable onPress={() => onChange(rows.filter((_, x) => x !== i))} hitSlop={8}>
                <Icon name="trash-outline" size={18} color={c.danger} />
              </Pressable>
            ) : null}
          </View>
          {cols.map((col) => (
            <View key={col.name} style={{ marginBottom: 8 }}>
              <SectionLabel>{col.label}</SectionLabel>
              {col.type === 'select'
                ? <SelectInput field={col} value={row[col.name] ?? ''} compact onChange={(v, o) => {
                    const next = { ...row, [col.name]: v };
                    // Marka tanlansa narx avtomatik to'ladi (bo'sh bo'lsa)
                    if (o?.extra) for (const [k, ev] of Object.entries(o.extra)) if (!next[k]?.trim()) next[k] = ev;
                    onChange(rows.map((r, x) => (x === i ? next : r)));
                  }} />
                : <Field
                    value={row[col.name] ?? ''}
                    onChangeText={(v) => set(i, col.name, v)}
                    placeholder={col.placeholder}
                    keyboardType={col.type === 'number' ? 'numeric' : 'default'}
                  />}
            </View>
          ))}
        </Card>
      ))}
      <Pressable
        onPress={() => onChange([...rows, emptyRow(field)])}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border }}
      >
        <Icon name="add" size={18} color={c.brandPrimary} />
        <Txt v="bodyStrong" color="brand" style={{ marginLeft: 6 }}>Yana qator</Txt>
      </Pressable>
    </View>
  );
}
