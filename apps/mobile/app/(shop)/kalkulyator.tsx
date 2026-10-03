import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Text as SvgText } from 'react-native-svg';
import { Callout, Card, Select, Txt, fmtNum } from '@/design/primitives';
import { ChipGroup, HeroCard, Reveal, StickyActionBar } from '@/design/blocks';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { alpha, elevation, radius, size, space, type as typeScale } from '@/design/tokens';
import { useShopCatalog } from '@/features/shop/api';
import { IsoBox } from '@/features/shop/art';

/**
 * Beton kalkulyatori — demo CLIENT[3]: konstruksiya chiplari, izometrik chizma (kiritilgan o'lchamlar
 * bilan), 3 ta o'lcham katakchasi, to'q natija kartasi (hajm, mikserlar, +5% zaxira, taxminiy narx) va
 * pastda "N m³ ni buyurtma qilish" (mahsulot sahifasini hajm to'ldirilgan holda ochadi).
 * Hisob faqat telefonda — serverga hech narsa ketmaydi.
 */
type Shape = 'strip' | 'slab' | 'column' | 'floor';
type Unit = 'm' | 'sm' | 'dona';
interface Field { key: 'a' | 'b' | 'c'; label: string; unit: Unit; placeholder: string }
interface Fig { ox: number; oy: number; w: number; d: number; h: number; labels: [number, number, number, number, number, number] }

const SHAPES: Record<Shape, { label: string; fields: [Field, Field, Field]; fig: Fig }> = {
  strip: {
    label: 'Lenta poydevor',
    fields: [
      { key: 'a', label: 'Uzunlik', unit: 'm', placeholder: '48' },
      { key: 'b', label: 'Kenglik', unit: 'm', placeholder: '0,4' },
      { key: 'c', label: 'Balandlik', unit: 'm', placeholder: '0,6' },
    ],
    // Demo `isoBox(40,24,150,16,26)` + yorliqlar: uzunlik (80,86), kenglik (200,40), balandlik (12,34)
    fig: { ox: 40, oy: 24, w: 150, d: 16, h: 26, labels: [80, 86, 200, 40, 12, 34] },
  },
  slab: {
    label: 'Plita',
    fields: [
      { key: 'a', label: 'Uzunlik', unit: 'm', placeholder: '10' },
      { key: 'b', label: 'Eni', unit: 'm', placeholder: '6' },
      { key: 'c', label: 'Qalinlik', unit: 'm', placeholder: '0,2' },
    ],
    fig: { ox: 92, oy: 12, w: 96, d: 52, h: 10, labels: [150, 86, 22, 70, 214, 30] },
  },
  column: {
    label: 'Ustun',
    fields: [
      { key: 'a', label: 'Soni', unit: 'dona', placeholder: '8' },
      { key: 'b', label: 'Kesim', unit: 'm', placeholder: '0,4' },
      { key: 'c', label: 'Balandlik', unit: 'm', placeholder: '3' },
    ],
    fig: { ox: 130, oy: 72, w: 16, d: 16, h: 62, labels: [176, 30, 176, 84, 60, 50] },
  },
  floor: {
    label: 'Pol',
    fields: [
      { key: 'a', label: 'Uzunlik', unit: 'm', placeholder: '12' },
      { key: 'b', label: 'Eni', unit: 'm', placeholder: '8' },
      { key: 'c', label: 'Qalinlik', unit: 'sm', placeholder: '10' },
    ],
    fig: { ox: 92, oy: 16, w: 100, d: 56, h: 5, labels: [150, 86, 22, 70, 214, 30] },
  },
};

const RESERVE = 0.05;
/** Bitta mikser odatda shuncha m³ olib keladi — reyslar soni taxminiy. */
const MIXER_M3 = 8;
const num = (s: string | undefined) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
const toM = (v: number, u: Unit) => (u === 'sm' ? v / 100 : v);
const fmtQ = (n: number) => fmtNum(n, n % 1 ? 1 : 0);

function volumeOf(shape: Shape, v: Record<string, string>) {
  const [fa, fb, fc] = SHAPES[shape].fields;
  const a = toM(num(v.a), fa.unit), b = toM(num(v.b), fb.unit), c = toM(num(v.c), fc.unit);
  return shape === 'column' ? a * b * b * c : a * b * c;
}

/** Demo `.calcfig`: brend tusidagi izometrik quti + kiritilgan o'lchamlar yozuvi. */
function Figure({ shape, values }: { shape: Shape; values: Record<string, string> }) {
  const { c } = useTheme();
  const { fig, fields } = SHAPES[shape];
  const [x1, y1, x2, y2, x3, y3] = fig.labels;
  const val = (f: Field) => `${values[f.key] || f.placeholder} ${f.unit}`;
  const t = (x: number, y: number, s: string) => <SvgText x={x} y={y} fontSize={typeScale.caption.fontSize - 3} fill={c.textMuted} textAnchor="middle">{s}</SvgText>;
  return (
    <Card style={{ padding: space.md }}>
      <Svg width="100%" height={size.driverTouch * 2.2} viewBox="0 0 260 90" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <IsoBox ox={fig.ox} oy={fig.oy} w={fig.w} d={fig.d} h={fig.h} fill={[c.brandSoft, alpha(c.brand, 0.35), alpha(c.brand, 0.55)]} />
        {t(x1, y1, `${fields[0].label} ${val(fields[0])}`)}
        {t(x2, y2, val(fields[1]))}
        {t(x3, y3, val(fields[2]))}
      </Svg>
    </Card>
  );
}

/** Demo `.fld`: yorliq (t-sm), katta qiymat + kichik birlik. */
function FieldCell({ f, value, onChange }: { f: Field; value: string; onChange: (t: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: c.bgSurface, borderRadius: radius.xl, borderCurve: 'continuous', paddingHorizontal: space.md + 2, paddingVertical: space.tight, gap: 2 }, elevation(c).sh1]}>
      <Txt v="tSm" numberOfLines={1}>{f.label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^0-9.,]/g, ''))}
          placeholder={f.placeholder}
          placeholderTextColor={c.textFaint}
          keyboardType={f.unit === 'dona' ? 'number-pad' : 'decimal-pad'}
          accessibilityLabel={`${f.label}, ${f.unit}`}
          style={[typeScale.kpiValue, { flexShrink: 1, minWidth: space.xl, color: c.textStrong, padding: 0 }]}
        />
        <Txt v="caption" color="body">{f.unit}</Txt>
      </View>
    </View>
  );
}

export default function Calculator() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useShopCatalog();
  const [shape, setShape] = useState<Shape>('strip');
  const [vals, setVals] = useState<Record<string, string>>({});

  // Faqat tayyor beton (m³)
  const concrete = useMemo(() => (q.data?.items ?? []).filter((i) => i.unit === 'm3'), [q.data]);
  const [productId, setProductId] = useState<string | null>(null);
  const product = concrete.find((i) => i.id === productId) ?? concrete[0] ?? null;

  const def = SHAPES[shape];
  // Har shaklning qiymatlari alohida — tur almashtirilsa kiritilgani yo'qolmaydi
  const scoped: Record<string, string> = Object.fromEntries(def.fields.map((f) => [f.key, vals[`${shape}.${f.key}`] ?? '']));
  const volume = volumeOf(shape, scoped);
  // Mikser yarim kubdan yuklaydi — +5% zaxira bilan yuqoriga yaxlitlanadi
  const withReserve = volume > 0 ? Math.ceil(volume * (1 + RESERVE) * 2) / 2 : 0;
  const minHit = !!product?.minQty && withReserve > 0 && withReserve < product.minQty;
  const amount = minHit ? product!.minQty! : withReserve;
  const sum = product ? amount * product.price : 0;
  const mixers = amount ? Math.ceil(amount / MIXER_M3) : 0;

  const order = () => {
    if (!product || !amount) return;
    router.push(`/(shop)/${product.id}?qty=${amount}` as never);
  };

  const muted = { color: c.textOnInverseMuted };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={size.topBar}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <Reveal gap={space.md + 2}>
          <ChipGroup<Shape> value={shape} onChange={setShape} items={(Object.keys(SHAPES) as Shape[]).map((k) => ({ key: k, label: SHAPES[k].label }))} />
          <Figure shape={shape} values={scoped} />
          <View style={{ flexDirection: 'row', gap: space.tight }}>
            {def.fields.map((f) => (
              <FieldCell key={`${shape}.${f.key}`} f={f} value={scoped[f.key] ?? ''} onChange={(t) => setVals((v) => ({ ...v, [`${shape}.${f.key}`]: t }))} />
            ))}
          </View>

          <HeroCard label="Kerakli hajm" value={volume > 0 ? fmtNum(volume, 1) : '—'} unit="m³">
            {volume > 0 ? (
              <View style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
                    <Icon name="truck" size={size.iconSm} color={c.textOnInverseMuted} />
                    <Txt v="tSm" style={muted}>{mixers} ta mikser</Txt>
                  </View>
                  <Txt v="tSm" style={muted} numberOfLines={1}>+5% zaxira bilan {fmtQ(withReserve)} m³</Txt>
                </View>
                {product ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md }}>
                    <Txt v="tSm" style={[muted, { flexShrink: 1 }]} numberOfLines={1}>Taxminiy narx, {product.strengthClass ?? product.code}</Txt>
                    <Txt v="titleMd" style={{ color: c.textOnInverse }}>{fmtNum(sum)} so&apos;m</Txt>
                  </View>
                ) : null}
              </View>
            ) : <Txt v="tSm" style={muted}>O&apos;lchamlarni kiriting — natija shu yerda chiqadi</Txt>}
          </HeroCard>

          {concrete.length > 1 ? (
            <Select
              label="Beton markasi"
              value={product?.id ?? null}
              options={concrete.map((i) => ({ value: i.id, label: i.name, hint: `${fmtNum(i.price)} so'm / m³` }))}
              onChange={(v) => setProductId(v)}
              containerStyle={{ marginBottom: 0 }}
            />
          ) : null}
          {minHit ? <Callout tone="info">{`Eng kam buyurtma — ${fmtNum(product!.minQty!)} m³, buyurtma shu hajm bilan ochiladi`}</Callout> : null}
          <Txt v="caption" align="center">Yetkazish va nasos narxini sotuv bo&apos;limi aniqlaydi</Txt>
        </Reveal>
      </ScrollView>

      <StickyActionBar
        primary={{
          title: amount ? `${fmtQ(amount)} m³ ni buyurtma qilish` : 'Buyurtma qilish',
          icon: 'shopping-cart',
          onPress: order,
          disabled: !product || !amount,
          disabledReason: !product ? "Do'konda beton mahsuloti topilmadi" : "Avval o'lchamlarni kiriting",
        }}
      />
    </KeyboardAvoidingView>
  );
}
