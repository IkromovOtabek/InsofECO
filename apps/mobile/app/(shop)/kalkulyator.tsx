import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon, Text as SvgText } from 'react-native-svg';
import { Button, Callout, Card, Input, Select, Txt, fmtNum } from '@/design/primitives';
import { Tabs } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { illus, radius, size, space } from '@/design/tokens';
import { useShopCatalog } from '@/features/shop/api';

/**
 * Beton kalkulyatori — "qancha beton kerak?" savoliga javob. Mijoz shakl va o'lchamni
 * kiritadi → hajm (zaxira bilan, 0.5 m³ ga yuqoriga yaxlitlangan — mikser shunday yuklaydi)
 * → tanlangan marka narxi bilan taxminiy summa → "Shu hajmda buyurtma" mahsulot formasini
 * hajm to'ldirilgan holda ochadi. Hisob faqat ilovada, serverga hech narsa ketmaydi.
 */
type Shape = 'slab' | 'strip' | 'column' | 'volume';

/** `mark` — chizmadagi harf (A, B, C / H) */
interface Field { key: string; label: string; unit: 'm' | 'sm' | 'dona' | 'm³'; placeholder: string; mark?: string }
const SHAPES: Record<Shape, { label: string; hint: string; tip: string; fields: Field[]; box: [number, number, number] }> = {
  slab: {
    label: 'Plita', hint: 'Pol, qavat orasidagi plita, maydoncha', tip: 'Plita uchun odatda M300 (B22.5) olinadi',
    box: [7, 5, 0.8],
    fields: [
      { mark: 'A', key: 'a', label: 'Uzunligi', unit: 'm', placeholder: '10' },
      { mark: 'B', key: 'b', label: 'Eni', unit: 'm', placeholder: '6' },
      { mark: 'C', key: 'c', label: 'Qalinligi', unit: 'sm', placeholder: '20' },
    ],
  },
  strip: {
    label: 'Poydevor', hint: 'Lenta poydevor — devorlar ostidagi tasma', tip: 'Uy poydevori uchun odatda M250–M300',
    box: [9, 1.2, 2.6],
    fields: [
      { mark: 'A', key: 'a', label: 'Umumiy uzunligi (perimetr)', unit: 'm', placeholder: '40' },
      { mark: 'B', key: 'b', label: 'Eni', unit: 'sm', placeholder: '40' },
      { mark: 'C', key: 'c', label: 'Balandligi', unit: 'sm', placeholder: '80' },
    ],
  },
  column: {
    label: 'Ustun', hint: "To'rtburchak ustunlar", tip: 'Ustunlar uchun odatda M300 va undan yuqori',
    box: [1.4, 1.4, 6],
    fields: [
      { key: 'n', label: 'Soni', unit: 'dona', placeholder: '8' },
      { mark: 'A', key: 'a', label: 'Kesim tomoni A', unit: 'sm', placeholder: '40' },
      { mark: 'B', key: 'b', label: 'Kesim tomoni B', unit: 'sm', placeholder: '40' },
      { mark: 'H', key: 'c', label: 'Balandligi', unit: 'm', placeholder: '3' },
    ],
  },
  volume: {
    label: 'Hajm', hint: 'Hajmni bilsangiz — to\'g\'ridan-to\'g\'ri', tip: '',
    box: [4, 4, 4],
    fields: [{ key: 'v', label: 'Hajm', unit: 'm³', placeholder: '12' }],
  },
};

const RESERVES = [0, 5, 10] as const;
const num = (s: string | undefined) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
/** O'lcham birligi → metr */
const toM = (v: number, unit: Field['unit']) => (unit === 'sm' ? v / 100 : v);

function rawVolume(shape: Shape, v: Record<string, string>): number {
  const m = Object.fromEntries(SHAPES[shape].fields.map((x) => [x.key, toM(num(v[x.key]), x.unit)]));
  const f = (k: string) => m[k] ?? 0;
  switch (shape) {
    case 'slab': case 'strip': return f('a') * f('b') * f('c');
    case 'column': return f('n') * f('a') * f('b') * f('c');
    case 'volume': return f('v');
  }
}

/** Shaklning kichik izometrik chizmasi — qaysi o'lcham qayerda ekanini ko'rsatadi. */
function ShapeSketch({ shape }: { shape: Shape }) {
  const [w, d, h] = SHAPES[shape].box;
  const S = 11, W = 240, H = 120;
  const cx = W / 2 - (w - d) * 0.866 * S / 2;
  const cy = H / 2 - ((w + d) * 0.5 * S - h * S) / 2;
  const P = (x: number, y: number, z: number) => `${(cx + (x - y) * 0.866 * S).toFixed(1)},${(cy + (x + y) * 0.5 * S - z * S).toFixed(1)}`;
  const at = (x: number, y: number, z: number) => ({ x: cx + (x - y) * 0.866 * S, y: cy + (x + y) * 0.5 * S - z * S });
  const L = (p: { x: number; y: number }, t: string, dx = 0, dy = 0) => (
    <SvgText x={p.x + dx} y={p.y + dy} fill={illus.crane.lattice} fontSize={11} fontWeight="700" textAnchor="middle">{t}</SvgText>
  );
  const [l1, l2, l3] = shape === 'column' ? ['A', 'B', 'H'] : ['A', 'B', 'C'];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Polygon points={`${P(0, d, 0)} ${P(w, d, 0)} ${P(w, d, h)} ${P(0, d, h)}`} fill={illus.concrete.left} />
      <Polygon points={`${P(w, 0, 0)} ${P(w, d, 0)} ${P(w, d, h)} ${P(w, 0, h)}`} fill={illus.concrete.right} />
      <Polygon points={`${P(0, 0, h)} ${P(w, 0, h)} ${P(w, d, h)} ${P(0, d, h)}`} fill={illus.concrete.top} />
      {shape !== 'volume' ? (
        <>
          {L(at(w / 2, d, 0), l1, -8, 14)}
          {L(at(w, d / 2, 0), l2, 10, 12)}
          {L(at(w, 0, h / 2), l3, 12, 4)}
        </>
      ) : L(at(w / 2, d / 2, h), 'm³', 0, 4)}
    </Svg>
  );
}

export default function Calculator() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useShopCatalog();
  const [shape, setShape] = useState<Shape>('slab');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [reserve, setReserve] = useState<(typeof RESERVES)[number]>(5);

  // Faqat tayyor beton (m³) — kalkulyator hajm hisoblaydi
  const concrete = useMemo(() => (q.data?.items ?? []).filter((i) => i.unit === 'm3'), [q.data]);
  const [productId, setProductId] = useState<string | null>(null);
  const product = concrete.find((i) => i.id === productId) ?? concrete[0] ?? null;

  const def = SHAPES[shape];
  // Har shaklning qiymatlari alohida saqlanadi — tab almashtirilsa kiritilgani yo'qolmaydi
  const set = (k: string) => (t: string) => setVals((v) => ({ ...v, [`${shape}.${k}`]: t }));
  const scoped = Object.fromEntries(def.fields.map((f) => [f.key, vals[`${shape}.${f.key}`] ?? '']));
  const volume = rawVolume(shape, scoped);
  // Mikser yarim kubdan yuklaydi — zaxira bilan yuqoriga yaxlitlaymiz
  const qtyScoped = volume > 0 ? Math.ceil(volume * (1 + reserve / 100) * 2) / 2 : 0;
  const minHit = !!product?.minQty && qtyScoped > 0 && qtyScoped < product.minQty;
  const orderAmount = minHit ? product!.minQty! : qtyScoped;
  const sum = product ? orderAmount * product.price : 0;

  const order = () => {
    if (!product || !orderAmount) return;
    router.push(`/(shop)/${product.id}?qty=${orderAmount}` as never);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.pageX, paddingBottom: insets.bottom + space.xxxl, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Tabs<Shape> value={shape} onChange={setShape} items={(Object.keys(SHAPES) as Shape[]).map((k) => ({ key: k, label: SHAPES[k].label }))} />

        <Card style={{ borderRadius: radius.card }}>
          <ShapeSketch shape={shape} />
          <Txt v="caption" align="center" style={{ marginBottom: space.md }}>{def.hint}</Txt>
          {def.fields.map((f, i) => (
            <Input
              key={`${shape}.${f.key}`}
              label={`${f.mark ? `${f.mark} — ` : ''}${f.label}, ${f.unit}`}
              value={scoped[f.key]}
              onChangeText={set(f.key)}
              placeholder={f.placeholder}
              keyboardType={f.unit === 'dona' ? 'number-pad' : 'decimal-pad'}
              mono
              containerStyle={i === def.fields.length - 1 ? { marginBottom: 0 } : undefined}
            />
          ))}
        </Card>

        {/* Zaxira — to'kilish, notekis tuproq, qolip kengayishi uchun */}
        <View style={{ gap: space.sm }}>
          <Txt v="label">Zaxira</Txt>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {RESERVES.map((r) => {
              const on = r === reserve;
              return (
                <Pressable
                  key={r} onPress={() => setReserve(r)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  style={{ flex: 1, minHeight: size.touch, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: size.hairline, borderColor: on ? c.brand : c.borderDefault, backgroundColor: on ? c.brandSoft : c.bgSurface }}
                >
                  <Txt v="bodyStrong" color={on ? 'brand' : 'body'}>{r ? `+${r}%` : "Yo'q"}</Txt>
                </Pressable>
              );
            })}
          </View>
          <Txt v="caption">To&apos;kilish va notekis joylar uchun 5% tavsiya qilinadi</Txt>
        </View>

        {concrete.length ? (
          <View>
            <Select
              label="Beton markasi"
              value={product?.id ?? null}
              options={concrete.map((i) => ({ value: i.id, label: i.name, hint: `${fmtNum(i.price)} so'm / m³` }))}
              onChange={(v) => setProductId(v)}
            />
            {def.tip ? <Txt v="caption" style={{ marginTop: -space.sm }}>{def.tip}</Txt> : null}
          </View>
        ) : null}

        {/* Natija */}
        <Card style={{ borderRadius: radius.card, gap: space.sm }}>
          <Txt v="overline" color="muted">Kerakli hajm</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
            <Txt v="metric" color="brand">{qtyScoped ? fmtNum(qtyScoped, qtyScoped % 1 ? 1 : 0) : '—'}</Txt>
            <Txt v="body" color="muted">m³</Txt>
          </View>
          {volume > 0 ? (
            <Txt v="caption">
              Hisob: {fmtNum(volume, 2)} m³{reserve ? ` + ${reserve}% zaxira` : ''} → 0.5 m³ ga yaxlitlandi
            </Txt>
          ) : <Txt v="caption">O&apos;lchamlarni kiriting</Txt>}
          {product && qtyScoped ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.sm }}>
              <Txt v="bodySm" color="muted">Taxminiy narx ({product.code})</Txt>
              <Txt v="titleMd">{fmtNum(sum)} so&apos;m</Txt>
            </View>
          ) : null}
          {minHit ? <Callout tone="info">{`Eng kam buyurtma — ${fmtNum(product!.minQty!)} m³, buyurtma shu hajm bilan ochiladi`}</Callout> : null}
          <Button title="Shu hajmda buyurtma berish" size="lg" icon="shopping-cart" disabled={!product || !orderAmount} onPress={order} style={{ marginTop: space.sm }} />
          <Txt v="caption" align="center">Yetkazish va nasos narxini sotuv bo&apos;limi aniqlaydi</Txt>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
