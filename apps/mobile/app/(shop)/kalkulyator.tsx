import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Polygon, Text as SvgText } from 'react-native-svg';
import { Callout, Card, Select, Skeleton, Txt, fmtNum } from '@/design/primitives';
import { ChipGroup, HeroCard, SegmentedControl, StickyActionBar } from '@/design/blocks';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space, type as typeScale } from '@/design/tokens';
import { useShopCatalog } from '@/features/shop/api';

/**
 * Beton kalkulyatori — "qancha beton kerak?" savoliga javob. Mijoz shakl va o'lchamni
 * kiritadi → hajm (zaxira bilan, 0.5 m³ ga yuqoriga yaxlitlangan — mikser shunday yuklaydi)
 * → tanlangan marka narxi bilan taxminiy summa → "Shu hajmda buyurtma" mahsulot formasini
 * hajm to'ldirilgan holda ochadi (pastdagi doimiy tugma). Hisob faqat ilovada, serverga hech narsa ketmaydi.
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

/** Bitta mikser (avtobetonaralashtirgich) odatda shuncha m³ olib keladi — reyslar soni taxminiy. */
const MIXER_M3 = 8;

/** Shaklning kichik izometrik chizmasi — qaysi o'lcham qayerda ekanini ko'rsatadi (brend tusida). */
function ShapeSketch({ shape }: { shape: Shape }) {
  const { c } = useTheme();
  const [w, d, h] = SHAPES[shape].box;
  const S = 11, W = 240, H = 120;
  const cx = W / 2 - (w - d) * 0.866 * S / 2;
  const cy = H / 2 - ((w + d) * 0.5 * S - h * S) / 2;
  const P = (x: number, y: number, z: number) => `${(cx + (x - y) * 0.866 * S).toFixed(1)},${(cy + (x + y) * 0.5 * S - z * S).toFixed(1)}`;
  const at = (x: number, y: number, z: number) => ({ x: cx + (x - y) * 0.866 * S, y: cy + (x + y) * 0.5 * S - z * S });
  const L = (p: { x: number; y: number }, t: string, dx = 0, dy = 0) => (
    <SvgText x={p.x + dx} y={p.y + dy} fill={c.brandInk} fontSize={typeScale.caption.fontSize} fontWeight="700" textAnchor="middle">{t}</SvgText>
  );
  const [l1, l2, l3] = shape === 'column' ? ['A', 'B', 'H'] : ['A', 'B', 'C'];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Polygon points={`${P(0, d, 0)} ${P(w, d, 0)} ${P(w, d, h)} ${P(0, d, h)}`} fill={c.brand} fillOpacity={0.35} />
      <Polygon points={`${P(w, 0, 0)} ${P(w, d, 0)} ${P(w, d, h)} ${P(w, 0, h)}`} fill={c.brand} fillOpacity={0.55} />
      <Polygon points={`${P(0, 0, h)} ${P(w, 0, h)} ${P(w, d, h)} ${P(0, d, h)}`} fill={c.brandSoft} />
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

/** O'lcham katakchasi (chizma "fld"): yorliq, katta raqam va birlik. */
function FieldCell({ f, value, onChange, basis }: { f: Field; value: string; onChange: (t: string) => void; basis: `${number}%` }) {
  const { c } = useTheme();
  return (
    <View style={[{ flexBasis: basis, flexGrow: 1, backgroundColor: c.bgSurface, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm }, shadow.card]}>
      <Txt v="caption" numberOfLines={1}>{f.mark ? `${f.mark} · ` : ''}{f.label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={f.placeholder}
          placeholderTextColor={c.textFaint}
          keyboardType={f.unit === 'dona' ? 'number-pad' : 'decimal-pad'}
          accessibilityLabel={`${f.label}, ${f.unit}`}
          style={[typeScale.titleMd, { flex: 1, color: c.textStrong, padding: 0, minHeight: size.iconXl + space.xs }]}
        />
        <Txt v="caption">{f.unit}</Txt>
      </View>
    </View>
  );
}

export default function Calculator() {
  const router = useRouter();
  const { c } = useTheme();
  const q = useShopCatalog();
  const [shape, setShape] = useState<Shape>('slab');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [reserve, setReserve] = useState<(typeof RESERVES)[number]>(5);

  // Faqat tayyor beton (m³) — kalkulyator hajm hisoblaydi
  const concrete = useMemo(() => (q.data?.items ?? []).filter((i) => i.unit === 'm3'), [q.data]);
  const [productId, setProductId] = useState<string | null>(null);
  const product = concrete.find((i) => i.id === productId) ?? concrete[0] ?? null;

  const def = SHAPES[shape];
  // Har shaklning qiymatlari alohida saqlanadi — tur almashtirilsa kiritilgani yo'qolmaydi
  const set = (k: string) => (t: string) => setVals((v) => ({ ...v, [`${shape}.${k}`]: t }));
  const scoped = Object.fromEntries(def.fields.map((f) => [f.key, vals[`${shape}.${f.key}`] ?? '']));
  const volume = rawVolume(shape, scoped);
  // Mikser yarim kubdan yuklaydi — zaxira bilan yuqoriga yaxlitlaymiz
  const qtyScoped = volume > 0 ? Math.ceil(volume * (1 + reserve / 100) * 2) / 2 : 0;
  const minHit = !!product?.minQty && qtyScoped > 0 && qtyScoped < product.minQty;
  const orderAmount = minHit ? product!.minQty! : qtyScoped;
  const sum = product ? orderAmount * product.price : 0;
  const mixers = orderAmount ? Math.ceil(orderAmount / MIXER_M3) : 0;
  const fmtQ = (n: number) => fmtNum(n, n % 1 ? 1 : 0);

  const order = () => {
    if (!product || !orderAmount) return;
    router.push(`/(shop)/${product.id}?qty=${orderAmount}` as never);
  };

  const basis = def.fields.length === 4 ? '40%' : def.fields.length === 1 ? '100%' : '28%';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={size.topBar}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <ChipGroup<Shape> value={shape} onChange={setShape} items={(Object.keys(SHAPES) as Shape[]).map((k) => ({ key: k, label: SHAPES[k].label }))} />

        <Card style={{ paddingVertical: space.md, gap: space.xs }}>
          <ShapeSketch shape={shape} />
          <Txt v="caption" align="center">{def.hint}</Txt>
        </Card>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {def.fields.map((f) => (
            <FieldCell key={`${shape}.${f.key}`} f={f} value={scoped[f.key] ?? ''} onChange={set(f.key)} basis={basis} />
          ))}
        </View>

        {/* Zaxira — to'kilish, notekis tuproq, qolip kengayishi uchun */}
        <View style={{ gap: space.sm }}>
          <Txt v="label">Zaxira · 5% tavsiya qilinadi</Txt>
          <SegmentedControl
            value={String(reserve) as `${(typeof RESERVES)[number]}`}
            onChange={(k) => setReserve(Number(k) as (typeof RESERVES)[number])}
            items={RESERVES.map((r) => ({ key: String(r) as `${(typeof RESERVES)[number]}`, label: r ? `+${r}%` : "Yo'q" }))}
          />
        </View>

        {q.isLoading ? <Skeleton height={size.input} radius={radius.sm} /> : concrete.length ? (
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

        {/* Natija — to'q karta */}
        <HeroCard label="Kerakli hajm" value={qtyScoped ? fmtQ(qtyScoped) : '—'} unit="m³">
          {volume > 0 ? (
            <View style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <Icon name="truck" size={size.iconSm} color={c.textOnInverseMuted} />
                  <Txt v="caption" style={{ color: c.textOnInverseMuted }}>~{mixers} ta mikser</Txt>
                </View>
                <Txt v="caption" style={{ color: c.textOnInverseMuted }} numberOfLines={1}>
                  {fmtNum(volume, 2)} m³{reserve ? ` + ${reserve}%` : ''}, 0,5 ga yaxlit
                </Txt>
              </View>
              {product ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md }}>
                  <Txt v="caption" style={{ color: c.textOnInverseMuted, flexShrink: 1 }} numberOfLines={1}>Taxminiy narx, {product.strengthClass ?? product.code}</Txt>
                  <Txt v="titleSm" style={{ color: c.textOnInverse }}>{fmtNum(sum)} so&apos;m</Txt>
                </View>
              ) : null}
            </View>
          ) : <Txt v="caption" style={{ color: c.textOnInverseMuted }}>O&apos;lchamlarni kiriting — natija shu yerda chiqadi</Txt>}
        </HeroCard>
        {minHit ? <Callout tone="info">{`Eng kam buyurtma — ${fmtNum(product!.minQty!)} m³, buyurtma shu hajm bilan ochiladi`}</Callout> : null}
        <Txt v="caption" align="center">Yetkazish va nasos narxini sotuv bo&apos;limi aniqlaydi</Txt>
      </ScrollView>

      <StickyActionBar
        primary={{
          title: orderAmount ? `${fmtQ(orderAmount)} m³ ni buyurtma qilish` : 'Buyurtma qilish',
          icon: 'shopping-cart',
          onPress: order,
          disabled: !product || !orderAmount,
          disabledReason: !product ? "Do'konda beton mahsuloti topilmadi" : "Avval o'lchamlarni kiriting",
        }}
      />
    </KeyboardAvoidingView>
  );
}
