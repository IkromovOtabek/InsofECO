import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Ellipse, Rect, Text as SvgText } from 'react-native-svg';
import { Button, Callout, Card, Select, Skeleton, Txt, fmtNum } from '@/design/primitives';
import { ChipGroup, CountUp, HeroCard, Reveal, StickyActionBar } from '@/design/blocks';
import { Icon } from '@/design/icons';
import { Appear, DUR, EASE_MICRO, SPRING_PRESS, useReducedMotion } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { alpha, elevation, radius, size, space, type as typeScale } from '@/design/tokens';
import { useShopCatalog } from '@/features/shop/api';
import { IsoBox } from '@/features/shop/art';
import {
  MIXER_CAPACITY_M3, RESERVE, SHAPES, SHAPE_KEYS, calcResult, fieldError, fmtPlain, parseNum, sanitizeInput, toMeters, unitHint, volumeOf,
  type CalcField, type FieldKey, type ShapeKey,
} from '@/features/shop/calc';

/**
 * Beton kalkulyatori — demo CLIENT[3]: konstruksiya chiplari (indikator suriladi), izometrik chizma
 * (kiritilgan o'lchamlar nisbatida, o'zgarganda silliq "morf"), 3 ta o'lcham katakchasi (har birida
 * o'z birligi — m / sm / dona, xato bo'lsa ostida yoziladi), to'q natija kartasi (hajm sanab chiqadi,
 * +5% zaxira, mikser reyslari, tanlangan markaning katalogdagi narxi bo'yicha summa) va pastda
 * "N m³ ni buyurtma qilish". Formulalar va tekshiruv misollari — `features/shop/calc.ts`.
 */

const VB = { w: 260, h: 100 };
/** Chizma joylashadigan maydon (yon tomonlarda yorliqlar uchun joy). */
const FIT = { w: 150, h: 64, cx: 130, cy: 46 };

/** Chizmadagi o'lcham: haqiqiy nisbatga yaqin, lekin juda ingichka/ulkan bo'lib ketmaydi. */
const soft = (v: number | null, ref: number) => (v == null ? 1 : Math.min(1.6, Math.max(0.55, (v / ref) ** 0.35)));

interface Geo { kind: 'box' | 'cyl'; w: number; d: number; h: number }

/** Shakl + kiritilgan qiymatlar (metrda) → chizma o'lchamlari (SVG birliklarida), maydonga sig'diriladi. */
function geometry(shape: ShapeKey, m: [number | null, number | null, number | null]): Geo {
  const ref = SHAPES[shape].fields.map((f) => toMeters(Number(f.placeholder), f.unit));
  const [a, b, c] = m;
  let g: Geo;
  if (shape === 'strip') g = { kind: 'box', w: 130 * soft(a, ref[0]!), d: 16 * soft(b, ref[1]!), h: 22 * soft(c, ref[2]!) };
  else if (shape === 'slab') g = { kind: 'box', w: 96 * soft(a, ref[0]!), d: 56 * soft(b, ref[1]!), h: 10 * soft(c, ref[2]!) };
  else if (shape === 'floor') g = { kind: 'box', w: 100 * soft(a, ref[0]!), d: 60 * soft(b, ref[1]!), h: 6 * soft(c, ref[2]!) };
  else if (shape === 'column') { const s = 18 * soft(b, ref[1]!); g = { kind: 'box', w: s, d: s, h: 56 * soft(c, ref[2]!) }; }
  else { const r = 16 * soft(b, ref[1]!); g = { kind: 'cyl', w: r * 2, d: r * 0.8, h: 56 * soft(c, ref[2]!) }; }
  const ex = g.kind === 'box' ? (g.w + g.d) * 0.866 : g.w;
  const ey = g.kind === 'box' ? (g.w + g.d) * 0.5 + g.h : g.h + g.d;
  const k = Math.min(1, FIT.w / ex, FIT.h / ey);
  return { kind: g.kind, w: g.w * k, d: g.d * k, h: g.h * k };
}

/** Raqamlar to'plamini silliq o'tkazadi (ease-out, ~380 ms) — SVG chizma "morfi" uchun. */
function useTween(target: number[], dur = DUR.state + 140): number[] {
  const reduce = useReducedMotion();
  const [cur, setCur] = useState(target);
  const from = useRef(target);
  const key = target.map((n) => n.toFixed(2)).join('|');
  useEffect(() => {
    if (reduce) { from.current = target; setCur(target); return; }
    const a = from.current;
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - (1 - k) ** 3;
      const v = target.map((x, i) => (a[i] ?? x) + (x - (a[i] ?? x)) * e);
      from.current = v;
      setCur(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduce]);
  return cur;
}

/** Natija o'zgarganda karta prujina bilan "sakraydi" (0.97 → 1). */
function useSpringBump(dep: unknown) {
  const reduce = useReducedMotion();
  const v = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduce) return;
    v.value = withSequence(withTiming(0.97, { duration: DUR.micro, easing: EASE_MICRO }), withSpring(1, SPRING_PRESS));
  }, [dep, reduce, v]);
  return useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
}

/** Demo `.calcfig`: brend tusidagi izometrik quti / silindr + kiritilgan o'lchamlar yozuvi. */
function Figure({ shape, values }: { shape: ShapeKey; values: Partial<Record<FieldKey, string>> }) {
  const { c } = useTheme();
  const fields = SHAPES[shape].fields;
  const meters = fields.map((f) => { const p = parseNum(values[f.key], f); return p.ok ? toMeters(p.value, f.unit) : null; }) as [number | null, number | null, number | null];
  const target = geometry(shape, meters);
  const [w = 0, d = 0, h = 0] = useTween([target.w, target.d, target.h]);
  const fill: [string, string, string] = [c.brandSoft, alpha(c.brand, 0.35), alpha(c.brand, 0.55)];
  const fs = typeScale.caption.fontSize - 3;
  const label = (x: number, y: number, f: CalcField, anchor: 'start' | 'middle' | 'end' = 'middle') => {
    const raw = values[f.key]?.trim();
    const ok = !!raw && parseNum(raw, f).ok;
    // Kiritilmagan bo'lsa — namuna (placeholder) xira rangda
    return <SvgText x={x} y={y} fontSize={fs} fill={ok ? c.textBody : c.textFaint} textAnchor={anchor}>{`${ok ? raw : f.placeholder} ${f.unit}`}</SvgText>;
  };
  const [fa, fb, fc] = fields;
  let body: React.ReactNode;
  if (target.kind === 'cyl') {
    // Silindr (svay): markazda; diametr — ostida, chuqurlik — chapda, soni — o'ng tepada
    const rx = w / 2, ry = d / 2, top = FIT.cy - h / 2, bot = FIT.cy + h / 2;
    body = (
      <>
        <Ellipse cx={FIT.cx} cy={bot} rx={rx} ry={ry} fill={fill[2]} />
        <Rect x={FIT.cx - rx} y={top} width={rx * 2} height={h} fill={fill[1]} />
        <Ellipse cx={FIT.cx} cy={top} rx={rx} ry={ry} fill={fill[0]} />
        {label(FIT.cx, bot + ry + 11, fb)}
        {label(FIT.cx - rx - 6, FIT.cy + 3, fc, 'end')}
        {label(VB.w - 8, 14, fa, 'end')}
      </>
    );
  } else {
    // Quti markazga: proyeksiya chegaralari [ox − d·0.866, ox + w·0.866] × [oy − h, oy + (w+d)/2]
    const ox = FIT.cx - ((w - d) * 0.866) / 2;
    const oy = FIT.cy - ((w + d) * 0.5 - h) / 2;
    const P = (x: number, y: number, z: number) => ({ x: ox + (x - y) * 0.866, y: oy + (x + y) * 0.5 - z });
    const front = P(w / 2, d, 0);
    const right = P(w, d / 2, 0);
    const left = P(0, d, h / 2);
    const isColumn = shape === 'column';
    body = (
      <>
        <IsoBox ox={ox} oy={oy} w={w} d={d} h={h} fill={fill} />
        {label(front.x, front.y + 12, isColumn ? fb : fa)}
        {isColumn ? label(VB.w - 8, 14, fa, 'end') : label(right.x + 6, right.y + 4, fb, 'start')}
        {label(left.x - 6, left.y + 3, fc, 'end')}
      </>
    );
  }
  return (
    <Card style={{ padding: space.md, overflow: 'hidden' }}>
      {/* Tur almashganda chizma kichikdan kattalashib kiradi; o'lcham o'zgarsa — silliq morf (useTween) */}
      <Appear replay={shape} instant scale={0.88} from={6} duration={DUR.state + 80}>
        <Svg width="100%" height={size.driverTouch * 2.2} viewBox={`0 0 ${VB.w} ${VB.h}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {body}
        </Svg>
      </Appear>
    </Card>
  );
}

/** Demo `.fld`: yorliq (t-sm), katta qiymat + kichik birlik; xato bo'lsa chegara va ostida izoh. */
function FieldCell({ f, value, onChange }: { f: CalcField; value: string; onChange: (t: string) => void }) {
  const { c } = useTheme();
  const err = fieldError(f, value);
  return (
    <View style={[{ flex: 1, minWidth: 0, backgroundColor: c.bgSurface, borderRadius: radius.xl, borderCurve: 'continuous', borderWidth: size.ring, borderColor: err ? c.dangerSolid : 'transparent', paddingHorizontal: space.md, paddingVertical: space.tight, gap: 2 }, elevation(c).sh1]}>
      <Txt v="tSm" numberOfLines={1}>{f.label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(sanitizeInput(t, f.integer))}
          placeholder={f.placeholder}
          placeholderTextColor={c.textFaint}
          keyboardType={f.integer ? 'number-pad' : 'decimal-pad'}
          returnKeyType="done"
          maxLength={9}
          selectTextOnFocus
          accessibilityLabel={`${f.label}, ${f.unit === 'sm' ? 'santimetr' : f.unit === 'm' ? 'metr' : 'dona'}`}
          accessibilityHint={err ?? undefined}
          style={[typeScale.kpiValue, { flex: 1, minWidth: space.xl, color: c.textStrong, padding: 0 }]}
        />
        <Txt v="caption" color="body">{f.unit}</Txt>
      </View>
      {err ? <Txt v="caption" color="danger" numberOfLines={1}>{err}</Txt> : null}
    </View>
  );
}

export default function Calculator() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useShopCatalog();
  const [shape, setShape] = useState<ShapeKey>('strip');
  const [vals, setVals] = useState<Record<string, string>>({});
  const navLock = useRef(0);

  // Faqat tayyor beton (m³) — narx katalogdagi haqiqiy narx
  const concrete = useMemo(() => (q.data?.items ?? []).filter((i) => i.unit === 'm3' && i.price > 0), [q.data]);
  const [productId, setProductId] = useState<string | null>(null);
  const product = concrete.find((i) => i.id === productId) ?? concrete[0] ?? null;

  const def = SHAPES[shape];
  // Har shaklning qiymatlari alohida — tur almashtirilsa kiritilgani yo'qolmaydi
  const scoped = Object.fromEntries(def.fields.map((f) => [f.key, vals[`${shape}.${f.key}`] ?? ''])) as Record<FieldKey, string>;
  const volume = volumeOf(shape, scoped);
  const res = calcResult(volume, { price: product?.price, minQty: product?.minQty, capacity: MIXER_CAPACITY_M3 });
  const hints = def.fields.map((f) => unitHint(f, scoped[f.key])).filter((x): x is string => !!x);
  const anyError = def.fields.some((f) => fieldError(f, scoped[f.key]));
  const bump = useSpringBump(res ? `${res.amount}|${res.sum}` : 'none');

  const order = () => {
    if (!product || !res || res.tooBig) return;
    // Tez ikki marta bosilsa mahsulot sahifasi ikki marta ochilmasin
    const now = Date.now();
    if (now - navLock.current < 800) return;
    navLock.current = now;
    router.push({ pathname: '/(shop)/[id]', params: { id: product.id, qty: String(res.amount) } } as never);
  };

  const muted = { color: c.textOnInverseMuted };
  const reservePct = Math.round(RESERVE * 100);
  const trips = res?.trips ?? [];
  const last = trips[trips.length - 1] ?? 0;
  const tripsText = trips.length > 1
    ? `${trips.length - 1} × ${MIXER_CAPACITY_M3} + ${fmtPlain(last)} m³`
    : trips.length ? `${fmtPlain(last)} m³` : '';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={size.topBar + insets.top}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Reveal gap={space.md + 2}>
          <ChipGroup<ShapeKey> value={shape} onChange={setShape} items={SHAPE_KEYS.map((k) => ({ key: k, label: SHAPES[k].label }))} />
          <Figure shape={shape} values={scoped} />
          <View style={{ flexDirection: 'row', gap: space.tight }}>
            {def.fields.map((f) => (
              <FieldCell key={`${shape}.${f.key}`} f={f} value={scoped[f.key]} onChange={(t) => setVals((v) => ({ ...v, [`${shape}.${f.key}`]: t }))} />
            ))}
          </View>
          {hints.length ? <Callout tone="warning">{hints.join('\n')}</Callout> : null}

          <Animated.View style={bump}>
            <HeroCard label="Kerakli hajm" value={res ? res.volume : '—'} format={(n) => fmtPlain(n)} unit="m³">
              {res ? (
                <View style={{ gap: space.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
                    <Txt v="tSm" style={[muted, { flexShrink: 1 }]} numberOfLines={1}>+{reservePct}% zaxira bilan</Txt>
                    <Txt v="bodyStrong" style={{ color: c.textOnInverse }} numberOfLines={1}>{fmtPlain(res.withReserve)} m³</Txt>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, flexShrink: 0 }}>
                      <Icon name="truck" size={size.iconSm} color={c.textOnInverseMuted} />
                      <Txt v="tSm" style={muted}>{trips.length} ta mikser</Txt>
                    </View>
                    <Txt v="tSm" style={[muted, { flexShrink: 1, textAlign: 'right' }]} numberOfLines={1}>{tripsText}</Txt>
                  </View>
                  <View style={{ height: size.hairline, backgroundColor: alpha(c.textOnInverse, 0.12) }} />
                  {product && res.sum != null ? (
                    <View style={{ gap: 2 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md }}>
                        <Txt v="tSm" style={[muted, { flexShrink: 0 }]} numberOfLines={1}>Taxminiy narx</Txt>
                        <CountUp value={res.sum} format={(n) => `${fmtNum(n)} so'm`} v="titleMd" style={{ color: c.textOnInverse, flexShrink: 1, textAlign: 'right' }} />
                      </View>
                      <Txt v="caption" style={muted} numberOfLines={1}>
                        {`${fmtPlain(res.amount)} m³ × ${fmtNum(product.price)} so'm · ${product.strengthClass ?? product.code ?? product.name}`}
                      </Txt>
                    </View>
                  ) : q.isLoading ? (
                    <Skeleton height={space.xl} inverse radius={radius.sm} />
                  ) : (
                    <Txt v="tSm" style={muted}>Narx: katalogda beton mahsuloti topilmadi</Txt>
                  )}
                </View>
              ) : (
                <Txt v="tSm" style={muted}>{anyError ? "O'lchamlardagi xatoni tuzating" : "O'lchamlarni kiriting — natija shu yerda chiqadi"}</Txt>
              )}
            </HeroCard>
          </Animated.View>

          {res?.tooBig ? <Callout tone="danger">Hajm juda katta — o&apos;lchamlar birligini (m / sm) tekshiring</Callout> : null}

          {concrete.length > 1 ? (
            <Select
              label="Beton markasi"
              value={product?.id ?? null}
              options={concrete.map((i) => ({ value: i.id, label: i.name, hint: `${fmtNum(i.price)} so'm / m³` }))}
              onChange={(v) => setProductId(v)}
              containerStyle={{ marginBottom: 0 }}
            />
          ) : null}
          {q.error && !q.data ? (
            <View style={{ gap: space.sm }}>
              <Callout tone="warning">Narxlar yuklanmadi — hajm hisoblanadi, narx internet bilan chiqadi</Callout>
              <Button title="Qayta urinish" variant="secondary" icon="refresh-cw" loading={q.isFetching} onPress={() => void q.refetch()} />
            </View>
          ) : null}
          {res?.minApplied && product?.minQty ? <Callout tone="info">{`Eng kam buyurtma — ${fmtPlain(product.minQty)} m³, narx va buyurtma shu hajm bilan`}</Callout> : null}
          <Txt v="caption" align="center">{`Zaxira +${reservePct}% (to'kilish, cho'kish), 0,1 m³ gacha yuqoriga yaxlitlanadi. Bir mikser — ${MIXER_CAPACITY_M3} m³. Yetkazish va nasos narxini sotuv bo'limi aniqlaydi`}</Txt>
        </Reveal>
      </ScrollView>

      <StickyActionBar
        primary={{
          title: res ? `${fmtPlain(res.amount)} m³ ni buyurtma qilish` : 'Buyurtma qilish',
          icon: 'shopping-cart',
          onPress: order,
          disabled: !product || !res || res.tooBig,
          disabledReason: !product ? (q.isLoading ? 'Narxlar yuklanmoqda' : "Do'konda beton mahsuloti topilmadi") : res?.tooBig ? "O'lchamlarni tekshiring" : "Avval o'lchamlarni kiriting",
        }}
      />
    </KeyboardAvoidingView>
  );
}
