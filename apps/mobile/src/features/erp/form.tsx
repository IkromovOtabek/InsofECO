import React, { useEffect, useMemo, useRef } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type * as ImagePickerNS from 'expo-image-picker';
import { Button, Card, IconButton, Input, Label, Select, Txt, type SelectOption } from '@/design/primitives';
import { Toggle } from '@/design/blocks';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space, toneColors, type Tone } from '@/design/tokens';
import type { ErpDayCell, ErpFormField, ErpFormOption } from '@/core/erp';

/**
 * Serverdan kelgan forma tavsifini chizadigan qism.
 *
 * Bitta joyda: kartochkadagi amal oynasi ham (masalan "To'lov qabul qilish"),
 * "Yangi zayavka / Yangi reys" ekrani ham shu komponentlarni ishlatadi.
 * Maydon turlari: text, number, date, time, select, switch, items (takrorlanuvchi qatorlar), photo (kamera/galereya).
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

/**
 * Maydon xatolari — hamma ko'rinadigan majburiy maydonlar bir yo'la (`firstMissing` bilan bir xil qoida).
 * Kalit — maydon nomi; `items` qatoridagi katak — `<maydon>.<qator>.<ustun>`.
 * Qiymat — maydon ostida chiqadigan qisqa matn.
 */
export type FieldErrors = Record<string, string>;

export function validate(fields: ErpFormField[], values: Values): FieldErrors {
  const out: FieldErrors = {};
  for (const f of visibleFields(fields, values)) {
    if (!f.required) continue;
    if (f.type === 'items') {
      const rows = (values[f.name] as ItemRow[]) ?? [];
      const cols = f.columns ?? [];
      let filled = 0;
      rows.forEach((r, i) => {
        if (!cols.some((c) => r[c.name]?.trim())) return;
        filled++;
        for (const c of cols) {
          if (c.required && !r[c.name]?.trim()) {
            out[`${f.name}.${i}.${c.name}`] = `${c.label} kiritilmagan`;
            out[f.name] ??= `${i + 1}-qatorda ${c.label} to'ldirilmagan`;
          }
        }
      });
      if (filled === 0) out[f.name] = 'Kamida bitta qator kerak';
      continue;
    }
    if (!str(values[f.name]).trim()) out[f.name] = f.type === 'select' || f.type === 'date' || f.type === 'time' ? 'Tanlanmagan' : f.type === 'photo' ? 'Surat kerak' : "To'ldirilmagan";
  }
  return out;
}

/** Xatolardan maydonni (va uning qator kataklarini) olib tashlaydi — qiymat o'zgarganda. */
export function clearError(errors: FieldErrors, name: string): FieldErrors {
  const keys = Object.keys(errors).filter((k) => k === name || k.startsWith(`${name}.`));
  if (!keys.length) return errors;
  const next = { ...errors };
  for (const k of keys) delete next[k];
  return next;
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

/** Maydon ostidagi xato qatori — Input'dagi bilan bir xil (ikonka + qizil izoh). */
function FieldError({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs }} accessibilityLiveRegion="polite">
      <Icon name="circle-alert" tone="danger" size={size.iconSm - 2} />
      <Txt v="caption" color="danger" style={{ flex: 1 }}>{text}</Txt>
    </View>
  );
}

/**
 * Bitta maydon. `errors` — `validate()` natijasi: maydon xatosi bo'lsa u qizil chegara/fon bilan
 * ajraladi va ostida sababi yoziladi (alohida oyna chiqmaydi).
 */
export function FieldInput({ field, values, onChange, errors }: { field: ErpFormField; values: Values; onChange: (name: string, v: string | ItemRow[]) => void; errors?: FieldErrors }) {
  const { c } = useTheme();
  const value = str(values[field.name]);
  const error = errors?.[field.name];

  // Input/Select o'z pastki bo'shlig'ini o'zi qo'yadi; qolgan turlar Label + tana + izoh sifatida chiziladi
  switch (field.type) {
    case 'select':
      return (
        <View>
          <SelectField field={field} value={value} error={error} onChange={(v, o) => { onChange(field.name, v); autofill(field, o, values, onChange); }} />
          {field.hint && !error ? <Txt v="caption" style={{ marginTop: -space.md, marginBottom: space.lg }}>{field.hint}</Txt> : null}
        </View>
      );
    case 'text':
    case 'number':
      return (
        <Input
          label={field.label}
          required={field.required}
          hint={field.hint}
          error={error}
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
        <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.card }, shadow.card]}>
          <Toggle value={value === 'true'} onChange={(v) => onChange(field.name, String(v))} label={field.label} />
        </View>
      );
      case 'date': return <DateInput field={field} value={value} onChange={(v) => onChange(field.name, v)} />;
      case 'time': return <TimeInput value={value} onChange={(v) => onChange(field.name, v)} />;
      case 'items': return <ItemsInput field={field} rows={(values[field.name] as ItemRow[]) ?? []} errors={errors} onChange={(rows) => onChange(field.name, rows)} />;
      case 'photo': return <PhotoInput value={value} onChange={(v) => onChange(field.name, v)} camera={field.camera} cameraOnly={field.cameraOnly} />;
      default: return null;
    }
  };

  // Sana/soat/surat — tanlov qatori xato bo'lsa qizil yumshoq fon ichiga olinadi (maydon ko'zga tashlansin)
  const framed = !!error && field.type !== 'items' && field.type !== 'switch';
  return (
    <View style={{ marginBottom: space.lg }}>
      {field.type === 'switch' ? null : <Label required={field.required} style={error ? { color: c.danger } : undefined}>{field.label}</Label>}
      <View style={framed ? { backgroundColor: c.dangerBg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: size.hairline, borderColor: c.danger, padding: space.sm } : undefined}>
        {body()}
      </View>
      {error ? <FieldError text={error} /> : field.hint ? <Txt v="caption" style={{ marginTop: space.xs }}>{field.hint}</Txt> : null}
    </View>
  );
}

// ───────────────────────── Surat (hujjat, nakladnoy) ─────────────────────────

/**
 * expo-image-picker native moduli eski dev build'da bo'lmasligi mumkin — to'g'ridan-to'g'ri import
 * ilovani yiqitadi. Shuning uchun faqat modul bor bo'lsa yuklanadi; bo'lmasa izoh ko'rsatiladi.
 */
const ImagePicker: typeof ImagePickerNS | null = requireOptionalNativeModule('ExponentImagePicker')
  ? (require('expo-image-picker') as typeof ImagePickerNS)
  : null;
const PHOTO_OPTS: ImagePickerNS.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true };

/** Qiymat — `data:<mime>;base64,...` satri: forma boshqa maydonlar bilan birga JSON bo'lib ketadi. */
function PhotoInput({ value, onChange, camera, cameraOnly }: { value: string; onChange: (v: string) => void; camera?: 'front' | 'back'; cameraOnly?: boolean }) {
  const { c } = useTheme();
  if (!ImagePicker) return <Txt v="caption">Bu ilova versiyasida kamera yo'q — hujjatni vebdan biriktiring.</Txt>;
  const picker = ImagePicker;
  const pick = async (fromCamera: boolean) => {
    if (fromCamera) {
      const perm = await picker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    // Yuz uchun old kamera; server kadrni kichraytiradi, shuning uchun sifat 0.5 yetadi
    const opts: ImagePickerNS.ImagePickerOptions = camera ? { ...PHOTO_OPTS, cameraType: camera === 'front' ? picker.CameraType.front : picker.CameraType.back } : PHOTO_OPTS;
    const r = fromCamera ? await picker.launchCameraAsync(opts) : await picker.launchImageLibraryAsync(opts);
    const a = r.canceled ? null : r.assets[0];
    if (a?.base64) onChange(`data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}`);
  };
  return (
    <View style={{ gap: space.sm }}>
      {value ? (
        <View style={[{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: c.bgMuted }, shadow.card]}>
          <Image source={{ uri: value }} style={{ width: '100%', aspectRatio: camera === 'front' ? 3 / 4 : 4 / 3 }} resizeMode="cover" accessibilityIgnoresInvertColors />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><Button title={cameraOnly ? (value ? 'Qayta olish' : 'Kamerani ochish') : 'Kamera'} variant="secondary" icon="camera" onPress={() => void pick(true)} /></View>
        {/* Jonli kadr talab qilinsa (yuz) galereya yo'q — telefondagi eski surat bilan belgilab bo'lmasin */}
        {cameraOnly ? null : <View style={{ flex: 1 }}><Button title="Galereya" variant="secondary" icon="image" onPress={() => void pick(false)} /></View>}
      </View>
      {value ? <Button title="Olib tashlash" variant="ghost" onPress={() => onChange('')} /> : null}
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
function SelectField({ field, value, onChange, compact, error }: { field: ErpFormField; value: string; onChange: (v: string, o?: ErpFormOption) => void; compact?: boolean; error?: string }) {
  const all: FormOption[] = field.options ?? [];
  return (
    <Select
      label={field.label}
      required={field.required}
      compact={compact}
      error={error}
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

/** Gorizontal tanlov chipi (sana/soat) — yumshoq oq plitka (soya), tanlangani to'liq brend fonida. */
function ChoiceChip({ on, onPress, label, children }: { on: boolean; onPress: () => void; label: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label}
      android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [
        { minHeight: size.touch, paddingHorizontal: space.md + space.xs, paddingVertical: space.sm, borderRadius: radius.md, borderCurve: 'continuous', backgroundColor: on ? c.brand : c.bgSurface, alignItems: 'center', justifyContent: 'center' },
        on ? null : shadow.card,
        pressed && !on && { backgroundColor: c.bgSubtle },
      ]}
    >
      {children}
    </Pressable>
  );
}

const DAY_NAMES = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Kunlik yuklama foizidan rang — quvvat bo'sh (qizil) dan to'lgan (yashil) gacha, veb "ish tartibi" bilan bir xil g'oya. */
const dayBand = (pct: number): Tone => (pct < 34 ? 'danger' : pct < 67 ? 'warning' : 'success');
const m3Text = (n: number) => `${n.toFixed(n % 1 ? 1 : 0)} m³`;

/** Sana chipi — kunlik quvvat rangi bilan (server yuborgan bo'lsa). Zayavka formasidagi "10 kunlik ish tartibi". */
function DayCapacityChip({ cell, on, onPress }: { cell: ErpDayCell; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const { ink, bg } = toneColors(c, dayBand(cell.pct));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio" accessibilityState={{ selected: on }}
      accessibilityLabel={`${cell.weekday} ${cell.label} — ${cell.count ? `${m3Text(cell.m3)}, ${cell.count} ta zayavka` : "bo'sh, joy ko'p"}`}
      android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [
        { minWidth: 68, minHeight: size.touch + space.lg, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.md, borderCurve: 'continuous', borderWidth: size.ring, borderColor: on ? c.brand : 'transparent', backgroundColor: bg, alignItems: 'center', justifyContent: 'center', gap: 2 },
        pressed && !on && { opacity: 0.85 },
      ]}
    >
      <Txt v="caption" color={cell.isToday ? 'brand' : 'muted'}>{cell.weekday}</Txt>
      <Txt v="bodyStrong" color={on ? 'brand' : 'strong'}>{cell.label}</Txt>
      <Txt v="caption" style={{ color: ink }}>{cell.count ? m3Text(cell.m3) : "bo'sh"}</Txt>
    </Pressable>
  );
}

/**
 * Sana — server "10 kunlik ish tartibi" (`field.cells`) yuborsa, shu kunlar kunlik quvvat
 * rangida chiqadi (veb bilan bir xil hisob: to'lgan kun yashil, bo'sh — qizil). Bo'lmasa
 * yaqin 14 kunlik oddiy chip qatoriga tushadi (masalan ta'minot "qachongacha kerak").
 */
function DateInput({ field, value, onChange }: { field: ErpFormField; value: string; onChange: (v: string) => void }) {
  const cells = field.cells;
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);
  const selIndex = cells?.length ? cells.findIndex((x) => x.key === value) : days.findIndex((d) => ymd(d) === value);
  const ref = useScrollToSelected(selIndex, cells?.length ? 76 : 70);

  if (cells?.length) {
    return (
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs, paddingHorizontal: 2 }}>
        {cells.map((cell) => <DayCapacityChip key={cell.key} cell={cell} on={cell.key === value} onPress={() => onChange(cell.key)} />)}
      </ScrollView>
    );
  }
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs, paddingHorizontal: 2 }}>
      {days.map((d, i) => {
        const v = ymd(d); const on = v === value;
        const day = i === 0 ? 'Bugun' : i === 1 ? 'Ertaga' : DAY_NAMES[d.getDay()];
        const date = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
        return (
          <ChoiceChip key={v} on={on} onPress={() => onChange(v)} label={`${day} ${date}`}>
            <Txt v="caption" color={on ? 'onBrand' : 'muted'}>{day}</Txt>
            <Txt v="bodyStrong" color={on ? 'onBrand' : 'strong'}>{date}</Txt>
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
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs, paddingHorizontal: 2 }}>
      {slots.map((t) => {
        const on = t === value;
        return (
          <ChoiceChip key={t} on={on} onPress={() => onChange(t)} label={t}>
            <Txt v="bodyStrong" color={on ? 'onBrand' : 'strong'}>{t}</Txt>
          </ChoiceChip>
        );
      })}
    </ScrollView>
  );
}

/** Takrorlanuvchi qatorlar — zayavka mahsulotlari. */
function ItemsInput({ field, rows, onChange, errors }: { field: ErpFormField; rows: ItemRow[]; onChange: (rows: ItemRow[]) => void; errors?: FieldErrors }) {
  const { c } = useTheme();
  const cols = field.columns ?? [];
  const cellError = (i: number, col: string) => errors?.[`${field.name}.${i}.${col}`];
  const set = (i: number, name: string, v: string) => onChange(rows.map((r, x) => (x === i ? { ...r, [name]: v } : r)));

  return (
    <View style={{ gap: space.md }}>
      {rows.map((row, i) => (
        <Card key={i} style={cols.some((col) => cellError(i, col.name)) ? { borderWidth: size.hairline, borderColor: c.danger } : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm, minHeight: size.touch - space.sm }}>
            <Txt v="overline" style={{ flex: 1 }}>{i + 1}-qator</Txt>
            {rows.length > 1 ? (
              <IconButton icon="trash" label="Qatorni o'chirish" tone="danger" size={size.touch - space.sm} onPress={() => onChange(rows.filter((_, x) => x !== i))} />
            ) : null}
          </View>
          {cols.map((col) => (
            col.type === 'select'
              ? <SelectField key={col.name} field={col} value={row[col.name] ?? ''} compact error={cellError(i, col.name)} onChange={(v, o) => {
                  const next = { ...row, [col.name]: v };
                  // Marka tanlansa narx avtomatik to'ladi (bo'sh bo'lsa)
                  if (o?.extra) for (const [k, ev] of Object.entries(o.extra)) if (!next[k]?.trim()) next[k] = ev;
                  onChange(rows.map((r, x) => (x === i ? next : r)));
                }} />
              : <Input
                  key={col.name}
                  label={col.label}
                  required={col.required}
                  error={cellError(i, col.name)}
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
