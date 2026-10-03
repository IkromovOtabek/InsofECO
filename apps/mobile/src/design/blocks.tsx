/**
 * Ekran bloklari — dashboard va kartochka sahifalari shu "g'ishtlar"dan yig'iladi.
 * Manba: `docs/redesign/demo.html` (`.appbar .hero .kpi2 .qa .sh .group .li .badge` + barsG / hbarsG / sparkG).
 * O'lchamlar demo css px × 1.38 (282 css → 390 dp), hammasi `tokens.ts` da (DEMO_SCALE izohlari).
 *
 * Yumshoq qatlam: chegara o'rniga soya (sh1), katta radius, pill tugmalar, ichki ajratuvchilar.
 * Harakat (Animatsiya v2): kirish — `Stagger` (motion.tsx); raqamlar sanab chiqadi; sparkline chiziladi + pulse;
 * ustunlar prujina bilan o'sadi; chiziqlar to'ladi; bosish — prujina 0.96 + haptika. Reduce motion — hammasi bir zumda.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { Icon, IconName } from './icons';
import { Appear, DUR, EASE_ENTER, PressScale, SPRING_GROW, SPRING_SLIDE, Shimmer, Stagger, haptic, useCountUp, useCountUpText, usePop, usePressScale } from './motion';
import { Button, Delta, IconButton, IconTile, ListGroup, ListItem, SectionHead, Txt, TxtColor, fmtNum } from './primitives';
import { SegmentTrack, fmtShort, toast } from './ui';
import { DEMO_SCALE, FONT, ModuleTone, Palette, Tone, TypeVariant, elevation, radius, size, space, toneColors } from './tokens';

export { SectionHead, ListGroup, Delta };

// ───────────────────────── Yordamchilar ─────────────────────────

/** Grafik o'qi uchun "chiroyli" maksimum — demo `niceMax`: 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10 × 10ⁿ. */
export function niceMax(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const CHART_KEYS = ['chart1', 'chart2', 'chart3', 'chart4'] as const;
const seriesColor = (c: Palette, i: number) => c[CHART_KEYS[i % CHART_KEYS.length]!];
/** Demo css px → dp. */
const px = (v: number) => v * DEMO_SCALE;

/** Element kengligini o'lchaydi (grafiklar, sparkline). */
function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => { const n = Math.round(e.nativeEvent.layout.width); if (n !== w) setW(n); }];
}

/** 0 → 1 (timing, demo `--ease`) kirishda bir marta, `deps` o'zgarsa qayta. Harakat kamaytirilgan bo'lsa darhol 1. */
function useGrow(delay = 0, deps: unknown[] = [], dur: number = DUR.fill) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) { p.value = 1; return; }
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: dur, easing: EASE_ENTER }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, delay, dur, ...deps]);
  return p;
}

/** Yumshoq karta yuzasi — demo `.card`: radius 28, padding 16, sh1, ichida ustun `gap`. */
function Surface({ children, style, pad = space.card, gap = space.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: number; gap?: number }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', padding: pad, gap }, elevation(c).sh1, style]}>{children}</View>;
}

// ───────────────────────── CountUp ─────────────────────────

/** Sanab chiqadigan raqam: `<CountUp value={1240} format={fmtNum} v="metric" />`. */
export function CountUp({ value, format = (n: number) => fmtNum(n), v = 'metric', color, delay, duration, style }: {
  /** Yakuniy qiymat. */ value: number;
  /** Formatlash (standart — `fmtNum`, minglar bo'shliq bilan). */ format?: (n: number) => string;
  v?: TypeVariant; color?: TxtColor; delay?: number; duration?: number;
  style?: React.ComponentProps<typeof Txt>['style'];
}) {
  const text = useCountUp(value, { format, delay, duration });
  return <Txt v={v} color={color} numberOfLines={1} adjustsFontSizeToFit style={style} accessibilityLabel={format(value)}>{text}</Txt>;
}

// ───────────────────────── PageHeader ─────────────────────────

export interface HeaderAction {
  icon: IconName;
  /** Ekran o'quvchisi uchun nom (majburiy). */ label: string;
  onPress: () => void;
  /** Son yoki nuqta nishoni (bildirishnomalar). `true` — qizil nuqta. */ badge?: number | boolean;
}

/** Demo `.ib`: 44 dp shaffof doira, 20 dp ikonka; `badge` — qizil nuqta (8 dp, bgChrome halqa, "pop" bilan chiqadi). */
function HeaderIcon({ icon, label, onPress, badge }: HeaderAction) {
  const { c } = useTheme();
  const ps = usePressScale(0.92);
  const pop = usePop(badge ? 1 : 0, 600);
  const num = typeof badge === 'number' && badge > 0;
  return (
    <Animated.View style={ps.style}>
      <Pressable
        onPress={() => { haptic.light(); onPress(); }} onPressIn={ps.onPressIn} onPressOut={ps.onPressOut}
        accessibilityRole="button" accessibilityLabel={num ? `${label}, ${badge}` : label}
        android_ripple={{ color: c.bgMuted, borderless: true }}
        style={{ width: size.headerAvatar, height: size.headerAvatar, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={icon} size={size.iconMd} color={c.textBody} strokeWidth={1.75} />
        {badge ? (
          <Animated.View style={[{ position: 'absolute', top: num ? space.xs : space.sm - 2, right: num ? space.xs - 2 : space.sm, minWidth: num ? space.xl : size.bellDot + size.ring * 2, height: num ? space.xl : size.bellDot + size.ring * 2, paddingHorizontal: num ? 3 : 0, borderRadius: radius.pill, backgroundColor: c.dangerSolid, borderWidth: size.ring, borderColor: c.bgChrome, alignItems: 'center', justifyContent: 'center' }, pop]}>
            {num ? <Txt v="badge" style={{ color: c.textOnSolid, fontFamily: FONT[700] }}>{(badge as number) > 99 ? '99+' : badge}</Txt> : null}
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Sahifa sarlavhasi — demo `.appbar`: chapda 44 dp avatar (brandSoft / brandInk bosh harflar), yonida overline
 * (12.5 dp, katta harf, textMuted) + sarlavha (18 dp og'ir); o'ngda shaffof doira ikonkalar (qo'ng'iroq qizil nuqta bilan).
 * Fon shaffof; `raised` bo'lsa (scroll — `useHeaderRaise()`) bgChrome + soya bilan ko'tariladi.
 * `onBack` — avatar o'rnida orqaga tugmasi (ichki sahifalar).
 */
export function PageHeader({ overline, title, avatar, onAvatar, actions, bell, raised, onBack, right, style }: {
  /** Kichik ustki yozuv: "Insof Beton MChJ", "Direktor · Insof Beton". */ overline?: string;
  /** Sahifa nomi yoki salom. */ title: string;
  /** Profil: rasm yoki ism (bosh harflar). */ avatar?: { name?: string; uri?: string };
  /** Avatar bosilganda (profil). */ onAvatar?: () => void;
  /** O'ngdagi ikonka tugmalar (ko'pi bilan 2 ta). */ actions?: HeaderAction[];
  /** Qo'ng'iroq (bildirishnomalar) — qisqa yo'l: `{ onPress, dot: true }` yoki `{ onPress, count: 3 }`. */
  bell?: { onPress: () => void; dot?: boolean; count?: number; label?: string };
  /** Scroll paytida ko'tarilgan holat (bgChrome + soya). */ raised?: boolean;
  /** Orqaga tugmasi (avatar o'rnida). */ onBack?: () => void;
  /** O'ng tomonga erkin element (masalan holat nishoni). */ right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const lift = useSharedValue(raised ? 1 : 0);
  useEffect(() => { lift.value = reduce ? (raised ? 1 : 0) : withTiming(raised ? 1 : 0, { duration: 300, easing: EASE_ENTER }); }, [raised, reduce, lift]);
  const bg = useAnimatedStyle(() => ({ opacity: lift.value }));
  const initials = (avatar?.name ?? '?').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const av = avatar ? (
    avatar.uri
      ? <Image source={{ uri: avatar.uri }} accessibilityIgnoresInvertColors style={{ width: size.headerAvatar, height: size.headerAvatar, borderRadius: radius.pill, backgroundColor: c.bgMuted }} />
      : (
        <View style={{ width: size.headerAvatar, height: size.headerAvatar, borderRadius: radius.pill, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Txt v="avatarInitials" style={{ color: c.brandInk }}>{initials}</Txt>
        </View>
      )
  ) : null;
  const all: HeaderAction[] = [
    ...(actions ?? []),
    ...(bell ? [{ icon: 'bell' as IconName, label: bell.label ?? 'Bildirishnomalar', onPress: bell.onPress, badge: bell.count ? bell.count : !!bell.dot }] : []),
  ];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md + 2, paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.md + 2, zIndex: 3 }, style]}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.bgChrome }, elevation(c).raised, bg]} />
      {onBack ? <IconButton icon="arrow-left" label="Orqaga" onPress={onBack} tone="strong" size={size.headerAvatar} /> : null}
      {av ? (onAvatar ? <PressScale onPress={onAvatar} accessibilityRole="button" accessibilityLabel={avatar?.name ?? 'Profil'} hitSlop={space.xs}>{av}</PressScale> : av) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {overline ? <Txt v="appbarOverline" numberOfLines={1}>{overline}</Txt> : null}
        <Txt v="appbarTitle" numberOfLines={1} accessibilityRole="header">{title}</Txt>
      </View>
      {right}
      {all.map((a) => <HeaderIcon key={a.label} {...a} />)}
    </View>
  );
}

// ───────────────────────── HeroCard ─────────────────────────

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Sparkline — demo `sparkG`: min×0.9 … max×1.02 masshtab, to'g'ri chiziqlar; maydon brand 20%,
 * chiziq 2.75 dp, oxirgi nuqta (inverse halqa) + pulse. Kirishda chiziq chiziladi (1.2 s), maydon keyin chiqadi.
 */
function Sparkline({ data, color, ring, height = size.heroSpark }: { data: number[]; color: string; ring: string; height?: number }) {
  const [w, onLayout] = useWidth();
  const reduce = useReducedMotion();
  const geo = useMemo(() => {
    if (w <= 0 || data.length < 2) return null;
    const pad = px(4);
    const mn = Math.min(...data) * 0.9, mx = Math.max(...data) * 1.02 || 1;
    const x = (i: number) => pad + (i * (w - 2 * pad)) / (data.length - 1);
    const y = (v: number) => height - pad - ((v - mn) / (mx - mn || 1)) * (height - 2 * pad);
    const pts = data.map((v, i) => ({ x: x(i), y: y(v) }));
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1]!;
    const area = `M${pts[0]!.x},${height} ${pts.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} L${last.x},${height} Z`;
    return { line, area, last, len: Math.ceil(len) + 1 };
  }, [w, data, height]);
  const key = data.join(',');
  const draw = useSharedValue(reduce ? 1 : 0);
  const area = useSharedValue(reduce ? 1 : 0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!geo) return;
    if (reduce) { draw.value = 1; area.value = 1; pulse.value = 0; return; }
    draw.value = 0; area.value = 0; pulse.value = 0;
    draw.value = withDelay(DUR.drawDelay, withTiming(1, { duration: DUR.draw, easing: EASE_ENTER }));
    area.value = withDelay(DUR.areaDelay, withTiming(1, { duration: DUR.area, easing: Easing.ease }));
    pulse.value = withDelay(DUR.pulseDelay, withRepeat(withTiming(1, { duration: DUR.pulse, easing: Easing.out(Easing.ease) }), -1, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, !!geo, reduce]);
  const len = geo?.len ?? 1;
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - draw.value) }));
  const areaProps = useAnimatedProps(() => ({ fillOpacity: 0.2 * area.value }));
  const r = px(4);
  const pulseProps = useAnimatedProps(() => ({ r: r * (1 + 2.2 * pulse.value), fillOpacity: pulse.value === 0 ? 0 : 0.55 * (1 - pulse.value) }));
  return (
    <View onLayout={onLayout} style={{ height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {geo ? (
        <Svg width={w} height={height}>
          <AnimatedPath d={geo.area} fill={color} animatedProps={areaProps} />
          <AnimatedPath d={geo.line} stroke={color} strokeWidth={px(2)} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[len, len]} animatedProps={lineProps} />
          {reduce ? null : <AnimatedCircle cx={geo.last.x} cy={geo.last.y} fill={color} animatedProps={pulseProps} />}
          <Circle cx={geo.last.x} cy={geo.last.y} r={r} fill={color} stroke={ring} strokeWidth={px(2)} />
        </Svg>
      ) : null}
    </View>
  );
}

/** Chizma palitrasi hero'si — 14 css (19 dp) katak, textOnInverse 8%. */
function HeroGrid({ color }: { color: string }) {
  const id = `hg${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const cell = Math.round(px(14));
  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} width="100%" height="100%">
      <Defs>
        <Pattern id={id} x={0} y={0} width={cell} height={cell} patternUnits="userSpaceOnUse">
          <Path d={`M0,0.5 H${cell} M0.5,0 V${cell}`} stroke={color} strokeOpacity={0.08} strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function HeroValue({ value, unit, fmt, color }: { value: number | string; unit?: string; fmt: (n: number) => string; color: string }) {
  const counted = useCountUp(typeof value === 'number' ? value : 0, { format: fmt });
  const countedText = useCountUpText(typeof value === 'string' ? value : '');
  const shown = typeof value === 'number' ? counted : countedText;
  return (
    <Txt v="heroValue" numberOfLines={1} adjustsFontSizeToFit style={{ color, flexShrink: 1 }}>
      {shown}
      {unit ? <Txt v="heroUnit" style={{ color }}>{` ${unit}`}</Txt> : null}
    </Txt>
  );
}

/**
 * Bosh ko'rsatkich kartasi — demo `.hero`: bgInverse, radius 32, padding 18, inverse rangli soya;
 * 20×4 aksent chiziqcha + overline (textOnInverseMuted); katta raqam 37 dp + birlik 17 dp (sanab chiqadi);
 * o'zgarish pill (successSolid / dangerSolid / warningSolid, oq matn, strelka); sparkline (chiziladi + pulse);
 * Chizma palitrasida xira katak fon; ixtiyoriy davr tanlagich (`.seg2`). Sahifada bitta.
 */
export function HeroCard({ label, value, unit, format, delta, spark, periods, period = 0, onPeriod, children, style, grid, sparkHeight, loading }: {
  /** Ustki yozuv: "Sof foyda". */ label: string;
  /** Raqam — sanab chiqadi; satr ("74,2") — ichidagi raqam sanab chiqadi. */ value: number | string;
  /** Birlik: "mln so'm", "m³". */ unit?: string;
  /** Raqam formati (standart `fmtNum`). */ format?: (n: number) => string;
  /** O'zgarish: `{ text: '12%', dir: 'up', tone: 'success' }`. */ delta?: { text: string; dir: 'up' | 'down'; tone: Tone };
  /** Sparkline nuqtalari (eng kamida 2). */ spark?: number[];
  /** Davr nomlari (demo `.seg2`): ['Hafta', 'Oy', 'Yil']. */ periods?: string[];
  /** Tanlangan davr indeksi. */ period?: number;
  onPeriod?: (i: number) => void;
  /** Karta ostiga qo'shimcha (masalan marshrut, tugmalar). */ children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Katak fon (standart: Chizma palitrasida yoqiq). */ grid?: boolean;
  /** Sparkline balandligi (standart 56 dp = 40 css). */ sparkHeight?: number;
  /** Yuklanmoqda — shimmer qoplama. */ loading?: boolean;
}) {
  const { c, paletteName } = useTheme();
  const fmt = format ?? ((n: number) => fmtNum(n));
  const showGrid = grid ?? paletteName === 'chizma';
  const solid = delta ? (delta.tone === 'danger' ? c.dangerSolid : delta.tone === 'warning' ? c.warningSolid : delta.tone === 'success' ? c.successSolid : delta.tone === 'info' ? c.infoSolid : c.bgInverseChip) : c.successSolid;
  const a11y = `${label}: ${typeof value === 'number' ? fmt(value) : value}${unit ? ` ${unit}` : ''}${delta ? `, ${delta.dir === 'down' ? '−' : '+'}${delta.text}` : ''}`;
  return (
    <View style={[{ borderRadius: radius.hero, borderCurve: 'continuous', backgroundColor: c.bgInverse }, elevation(c).hero, style]}>
      <View style={{ borderRadius: radius.hero, borderCurve: 'continuous', overflow: 'hidden', padding: space.lg + 2, gap: space.tight }}>
        {showGrid ? <HeroGrid color={c.textOnInverse} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1, minWidth: 0 }}>
            <View style={{ width: size.heroAccentW, height: size.heroAccentH, borderRadius: radius.pill, backgroundColor: c.accent }} />
            <Txt v="appbarOverline" numberOfLines={1} style={{ color: c.textOnInverseMuted, flexShrink: 1 }}>{label}</Txt>
          </View>
          {periods?.length ? (
            <SegmentTrack variant="inverse" scroll={false} items={periods.map((p, i) => ({ key: String(i), label: p }))} value={String(period)} onChange={(k) => onPeriod?.(Number(k))} />
          ) : null}
        </View>
        <View accessible accessibilityLabel={a11y} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.tight, flexWrap: 'wrap' }}>
          <HeroValue value={value} unit={unit} fmt={fmt} color={c.textOnInverse} />
          {delta ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingVertical: 3, marginBottom: space.xs, borderRadius: radius.sm - 4, backgroundColor: solid }}>
              <Icon name={delta.dir === 'down' ? 'arrow-down' : 'arrow-up'} size={size.iconSm - 2} color={c.textOnSolid} strokeWidth={2.25} />
              <Txt v="heroDelta" style={{ color: c.textOnSolid }}>{delta.text}</Txt>
            </View>
          ) : null}
        </View>
        {spark && spark.length > 1 ? <Sparkline data={spark} color={c.brand} ring={c.bgInverse} height={sparkHeight} /> : null}
        {children}
        {loading ? <Shimmer inverse /> : null}
      </View>
    </View>
  );
}

// ───────────────────────── KpiGrid ─────────────────────────

export interface KpiItem {
  label: string;
  /** Raqam — sanab chiqadi (`fmtNum`); satr ("312 mln") — ichidagi raqam sanab chiqadi. */ value: number | string;
  /** O'zgarish: `{ text: '+8%', tone: 'success' }` — ton rangida, 12.5 dp qalin. */ delta?: { text: string; tone: Tone };
  /** Qiymat rangi (xavf/ogohlantirish). Standart — textStrong. */ tone?: Tone;
  /** Plitka ikonkasi; berilmasa plitkasiz (demo direktor KPI). */ icon?: IconName;
  module?: ModuleTone;
  onPress?: () => void;
}

/** Demo `.card.kpi`: padding 12, chapda 40 dp plitka (radius 15), o'ngda yorliq / qiymat / o'zgarish. */
function KpiCell({ item }: { item: KpiItem }) {
  const { c } = useTheme();
  const ps = usePressScale();
  const counted = useCountUp(typeof item.value === 'number' ? item.value : 0, { format: (n) => fmtNum(n) });
  const countedText = useCountUpText(typeof item.value === 'string' ? item.value : '');
  const shown = typeof item.value === 'number' ? counted : countedText;
  const valueColor = item.tone && item.tone !== 'neutral' && item.tone !== 'brand' ? toneColors(c, item.tone).ink : c.textStrong;
  const deltaColor = item.delta ? (item.delta.tone === 'brand' ? c.brandInk : item.delta.tone === 'neutral' ? c.textMuted : toneColors(c, item.delta.tone).ink) : c.textMuted;
  return (
    <Animated.View style={[{ flex: 1 }, ps.style]}>
      <Pressable
        onPress={item.onPress ? () => { haptic.light(); item.onPress!(); } : undefined} disabled={!item.onPress}
        onPressIn={item.onPress ? ps.onPressIn : undefined} onPressOut={item.onPress ? ps.onPressOut : undefined}
        accessibilityRole={item.onPress ? 'button' : undefined}
        accessibilityLabel={`${item.label}: ${typeof item.value === 'number' ? fmtNum(item.value) : item.value}${item.delta ? `, ${item.delta.text}` : ''}`}
        style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, padding: item.icon ? space.md : space.md + 2, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous' }, elevation(c).sh1]}
      >
        {item.icon ? <IconTile icon={item.icon} module={item.module} size={size.tile} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="tSm" numberOfLines={1}>{item.label}</Txt>
          <Txt v="kpiValue" numberOfLines={1} adjustsFontSizeToFit style={{ color: valueColor }}>{shown}</Txt>
          {item.delta ? <Txt v="kpiDelta" numberOfLines={1} style={{ color: deltaColor }}>{item.delta.text}</Txt> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Demo `.kpi2`: 2 ustunli (yoki `columns={3}`) KPI kartalari, oraliq 11 dp. Kirish animatsiyasi — ota `Stagger`. */
export function KpiGrid({ items, columns = 2, style }: { items: KpiItem[]; columns?: 2 | 3; style?: StyleProp<ViewStyle> }) {
  const rows: KpiItem[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={[{ gap: space.tight }, style]}>
      {rows.map((r, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: space.tight, alignItems: 'stretch' }}>
          {r.map((it) => <KpiCell key={it.label} item={it} />)}
          {Array.from({ length: columns - r.length }).map((_, i) => <View key={`e${i}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── ActionGrid ─────────────────────────

export interface ActionItem { label: string; icon: IconName; module?: ModuleTone; onPress: () => void; /** Son nishoni. */ badge?: number }

function ActionCell({ a, primary }: { a: ActionItem; primary: boolean }) {
  const { c } = useTheme();
  const ps = usePressScale();
  return (
    <Animated.View style={[{ flex: 1 }, ps.style]}>
      <Pressable
        onPress={() => { haptic.light(); a.onPress(); }} onPressIn={ps.onPressIn} onPressOut={ps.onPressOut}
        accessibilityRole="button" accessibilityLabel={a.badge ? `${a.label}, ${a.badge}` : a.label}
        style={[{ flex: 1, alignItems: 'center', gap: space.sm - 1, paddingVertical: space.md - 1, paddingHorizontal: 3, borderRadius: radius.action, borderCurve: 'continuous', backgroundColor: primary ? c.brand : c.bgSurface }, elevation(c).sh1]}
      >
        <IconTile icon={a.icon} module={a.module} size={size.actionTile} bg={primary ? c.brandTile : undefined} ink={primary ? c.textOnBrand : undefined} />
        <Txt v="actionLabel" align="center" numberOfLines={2} style={{ color: primary ? c.textOnBrand : c.textBody }}>{a.label}</Txt>
        {a.badge ? (
          <View style={{ position: 'absolute', top: space.xs + 2, right: space.sm, minWidth: space.xl, height: space.xl, paddingHorizontal: space.xs, borderRadius: radius.pill, backgroundColor: c.dangerSolid, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="badge" style={{ color: c.textOnSolid }}>{a.badge > 99 ? '99+' : a.badge}</Txt>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Tezkor amallar — demo `.qa`: 4 ustun, oraliq 8; karta radius 30, padding 11×3, 42 dp plitka + 12 dp yorliq markazda.
 * BIRINCHI element asosiy: brend fon, textOnBrand yorliq, plitka foni oq 25% (`c.brandTile`). `primaryIndex={null}` — asosiysiz.
 */
export function ActionGrid({ items, primaryIndex = 0, style }: { items: ActionItem[]; primaryIndex?: number | null; style?: StyleProp<ViewStyle> }) {
  const rows: ActionItem[][] = [];
  for (let i = 0; i < items.length; i += 4) rows.push(items.slice(i, i + 4));
  return (
    <View style={[{ gap: space.sm }, style]}>
      {rows.map((r, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'stretch' }}>
          {r.map((a, ci) => <ActionCell key={a.label} a={a} primary={primaryIndex === ri * 4 + ci} />)}
          {Array.from({ length: 4 - r.length }).map((_, i) => <View key={`e${i}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── AttentionList ─────────────────────────

export interface AttentionItem {
  title: string;
  sub?: string;
  icon: IconName;
  module?: ModuleTone;
  /** Holat nishoni: `{ text: 'Kechikmoqda', tone: 'warning' }`. */ badge?: { text: string; tone: Tone };
  /** O'ngdagi qiymat (summa, son). */ value?: string;
  onPress?: () => void;
}

/** Demo "E'tibor talab qiladi": ListGroup qatorlari — plitka, sarlavha + izoh, o'ngda nishon YOKI qiymat YOKI chevron. */
export function AttentionList({ items, style }: { items: AttentionItem[]; style?: StyleProp<ViewStyle> }) {
  return (
    <ListGroup style={style}>
      {items.map((it, i) => (
        <ListItem
          key={`${it.title}-${i}`} title={it.title} subtitle={it.sub} subtitleLines={2}
          icon={it.icon} module={it.module} onPress={it.onPress}
          badge={it.badge} value={it.badge ? undefined : it.value}
          chevron={!it.badge && !it.value}
        />
      ))}
    </ListGroup>
  );
}

// ───────────────────────── Grafiklar ─────────────────────────

/** Demo legenda: 11 dp kvadrat (radius 4) + 13 dp yozuv textBody, oraliq 16. */
function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs }}>
      {items.map((l) => (
        <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
          <View style={{ width: size.legend, height: size.legend, borderRadius: radius.legend, backgroundColor: l.color }} />
          <Txt v="legend">{l.label}</Txt>
        </View>
      ))}
    </View>
  );
}

/** Bitta ustun: yumaloq tepa (r), pastdan prujina bilan o'sadi (demo `grow .8s var(--spring)`). */
function GrowBar({ x, base, h, bw, r, color, delay }: { x: number; base: number; h: number; bw: number; r: number; color: string; delay: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) { p.value = 1; return; }
    p.value = 0;
    p.value = withDelay(delay, withSpring(1, SPRING_GROW));
  }, [h, delay, reduce, p]);
  const props = useAnimatedProps(() => {
    const hgt = Math.max(0, h * p.value);
    if (hgt < 0.5) return { d: `M${x},${base} Z` };
    const rr = Math.min(r, hgt);
    return { d: `M${x},${base} V${base - hgt + rr} q0,${-rr} ${rr},${-rr} h${bw - 2 * rr} q${rr},0 ${rr},${rr} V${base} Z` };
  });
  return <AnimatedPath fill={color} animatedProps={props} />;
}

/** Demo `barsG` o'q formati: 1000 dan katta — "1.5k". */
const fmtAxis = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : String(+v.toFixed(1)));

/**
 * Ustunli grafik kartasi — demo `barsG`: sarlavha + birlik (`.sh`), 2 seriyada legenda, setka 0 / o'rta / maks
 * (0 dan boshqalari punktir), guruhlangan ustunlar (eni ≤ 10 css, tepasi radius 4, chart1 / chart2), x yozuvlari 8 css.
 * Geometriya demo viewBox (252×112) ga mutanosib; ustunlar ketma-ket prujina bilan o'sadi.
 */
export function BarChartCard({ title, unit, labels, series, height, format = fmtAxis, highlight, style }: {
  title: string;
  /** Birlik izohi (o'ngda): "mln so'm", "m³". */ unit?: string;
  /** X o'qi yozuvlari (5 belgigacha). */ labels: string[];
  /** 1–2 seriya; `data` uzunligi `labels` bilan teng. */ series: { name: string; data: number[] }[];
  /** Grafik balandligi, dp (standart — eniga mutanosib, 112/252). */ height?: number;
  /** Y o'qi formati (standart demo: 1.5k). */ format?: (n: number) => string;
  /** Qalin x yozuvi (masalan bugun). */ highlight?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const [w, onLayout] = useWidth();
  const shown = series.slice(0, 2);
  const n = labels.length;
  const max = niceMax(Math.max(0, ...shown.flatMap((s) => s.data.slice(0, n))));
  const k = w / 252;
  const H = height ?? 112 * k;
  const l = 28 * k, b = 16 * k, t = 6 * k, ch = H - b - t, base = t + ch;
  const gwc = (252 - 28 - 4) / Math.max(1, n);
  const ns = Math.max(1, shown.length);
  const bwc = Math.max(2, Math.min(10, (gwc - 6) / ns - 2));
  const bw = bwc * k, gap = 2 * k, r = Math.min(4, bwc / 2) * k, gw = gwc * k;
  const y = (v: number) => t + ch - (v / max) * ch;
  const fs = 8 * k;
  const summary = shown.map((s) => `${s.name}: ${s.data.map((v, i) => `${labels[i]} ${format(v)}`).join(', ')}`).join('; ');
  return (
    <Surface style={style} gap={space.sm}>
      <SectionHead title={title} unit={unit} />
      {shown.length > 1 ? <Legend items={shown.map((s, i) => ({ label: s.name, color: seriesColor(c, i) }))} /> : null}
      <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={`${title}. ${summary}`} style={{ height: w ? H : 112 * ((390 - 72) / 252) }}>
        {w > 0 && n > 0 ? (
          <Svg width={w} height={H}>
            {[0, max / 2, max].map((v) => (
              <React.Fragment key={v}>
                <Line x1={l} x2={w - 2 * k} y1={y(v)} y2={y(v)} stroke={c.chartGrid} strokeWidth={1} strokeDasharray={v ? [2 * k, 3 * k] : undefined} />
                <SvgText x={l - 5 * k} y={y(v) + 3 * k} fontSize={fs} fontFamily={FONT[500]} fill={c.textMuted} textAnchor="end">{format(v)}</SvgText>
              </React.Fragment>
            ))}
            {labels.map((lab, i) => {
              const gx = l + i * gw + (gw - (ns * bw + (ns - 1) * gap)) / 2;
              return (
                <React.Fragment key={`${lab}-${i}`}>
                  {shown.map((s, si) => {
                    const v = Math.max(0, s.data[i] ?? 0);
                    return <GrowBar key={s.name} x={gx + si * (bw + gap)} base={base} h={base - y(v)} bw={bw} r={r} color={seriesColor(c, si)} delay={DUR.barDelay + i * DUR.barStep} />;
                  })}
                  <SvgText x={l + i * gw + gw / 2} y={H - 4 * k} fontSize={fs} fontFamily={highlight === i ? FONT[700] : FONT[500]} fill={highlight === i ? c.textStrong : c.textMuted} textAnchor="middle">{String(lab).slice(0, 5)}</SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        ) : null}
      </View>
    </Surface>
  );
}

function HBar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const p = useGrow(delay, [pct]);
  const s = useAnimatedStyle(() => ({ width: `${pct * p.value}%` }));
  return <Animated.View style={[{ height: '100%', borderRadius: radius.pill, backgroundColor: color }, s]} />;
}

/**
 * Gorizontal ustunlar — demo `hbarsG`: qator = yorliq (108 dp) | 11 dp chiziq (chartTrack, chart1 to'ladi) | qalin qiymat.
 * Qatorlar oralig'i 10 dp; chiziqlar 1.1 s da to'ladi.
 */
export function HBarList({ title, unit, items, format = (n: number) => fmtNum(n), style }: {
  title: string; unit?: string;
  items: { label: string; value: number }[];
  /** Qiymat formati (standart `fmtNum`). */ format?: (n: number) => string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <Surface style={style} gap={space.sm}>
      <SectionHead title={title} unit={unit} />
      <View style={{ gap: space.sm + 2 }}>
        {items.map((it, i) => (
          <View key={`${it.label}-${i}`} accessible accessibilityLabel={`${it.label}: ${format(it.value)}${unit ? ` ${unit}` : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.tight }}>
            <Txt v="chartRow" numberOfLines={1} style={{ width: Math.round(px(78)) }}>{it.label}</Txt>
            <View style={{ flex: 1, height: size.hbar, borderRadius: radius.pill, backgroundColor: c.chartTrack, overflow: 'hidden' }}>
              <HBar pct={(Math.max(0, it.value) / max) * 100} color={c.chart1} delay={DUR.fillDelay - 50 + i * 40} />
            </View>
            <Txt v="chartRow" style={{ fontFamily: FONT[600], color: c.textStrong, fontVariant: ['tabular-nums'] }}>{format(it.value)}</Txt>
          </View>
        ))}
      </View>
    </Surface>
  );
}

/**
 * Taqsimot kartasi — demo breakdown: 14 dp segmentli chiziq (pill bo'laklar, 3 dp oraliq, chart1–4) va
 * 2 ustunli legenda: kvadrat + nom (chap), qalin ulush % (o'ng). 4 tadan ortig'i "Boshqa"ga yig'iladi (textFaint).
 */
export function BreakdownCard({ title, items, unit, format = (n: number) => fmtShort(n), otherLabel = 'Boshqa', showValue, style }: {
  title: string;
  items: { label: string; value: number }[];
  unit?: string;
  /** Qiymat formati (`showValue` bilan). */ format?: (n: number) => string;
  otherLabel?: string;
  /** Ulush yonida qiymat ham (standart — faqat %, demo kabi). */ showValue?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((s, r) => s + r.value, 0);
  const rows = rest > 0 ? [...top, { label: otherLabel, value: rest }] : top;
  const sum = rows.reduce((s, r) => s + r.value, 0) || 1;
  const color = (i: number) => (i < 4 ? seriesColor(c, i) : c.textFaint);
  const grow = useGrow(DUR.fillDelay, [rows.map((r) => r.value).join(',')]);
  const bar = useAnimatedStyle(() => ({ width: `${grow.value * 100}%` }));
  const pct = (v: number) => Math.round((v / sum) * 100);
  return (
    <Surface style={style} gap={space.tight}>
      <SectionHead title={title} unit={unit} />
      <View style={{ height: size.breakdownBar }} accessibilityElementsHidden>
        <Animated.View style={[{ flexDirection: 'row', height: '100%', gap: 3, overflow: 'hidden', borderRadius: radius.pill }, bar]}>
          {rows.map((r, i) => <View key={r.label} style={{ flex: r.value, backgroundColor: color(i), borderRadius: radius.pill }} />)}
        </Animated.View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.xs + 2, columnGap: space.lg }}>
        {rows.map((r, i) => (
          <View key={r.label} accessible accessibilityLabel={`${r.label}: ${pct(r.value)}%`} style={{ width: '46%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 3, flex: 1, minWidth: 0 }}>
              <View style={{ width: size.legend, height: size.legend, borderRadius: radius.legend, backgroundColor: color(i) }} />
              <Txt v="chartRow" numberOfLines={1} style={{ flexShrink: 1 }}>{r.label}</Txt>
            </View>
            <Txt v="chartRow" style={{ fontFamily: FONT[600], color: c.textStrong }}>{showValue ? `${pct(r.value)}% · ${format(r.value)}` : `${pct(r.value)}%`}</Txt>
          </View>
        ))}
      </View>
    </Surface>
  );
}

/** Reja kartasi — demo progress: nom (16 dp qalin) ↔ foiz, 8 dp chiziq (chartTrack, chart1 to'ladi), izoh `t-sm`. */
export function ProgressCard({ title, value, caption, tone, children, style }: {
  title: string;
  /** 0–100. */ value: number;
  /** Ostidagi izoh: "86 / 120 m³". */ caption?: string;
  /** Rang (standart chart1). */ tone?: Tone;
  /** Ostiga qo'shimcha (masalan `Timeline`). */ children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const fill = !tone || tone === 'brand' ? c.chart1 : toneColors(c, tone).solid;
  const shown = useCountUp(pct, { format: (n) => `${Math.round(n)}%` });
  return (
    <Surface style={style} gap={space.sm}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={title} accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }} style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          <Txt v="listTitle" numberOfLines={1} style={{ flex: 1 }}>{title}</Txt>
          <Txt v="listValue" style={{ fontVariant: ['tabular-nums'] }}>{shown}</Txt>
        </View>
        <View style={{ height: size.progressLg, borderRadius: radius.pill, backgroundColor: c.chartTrack, overflow: 'hidden' }}>
          <HBar pct={pct} color={fill} delay={DUR.fillDelay} />
        </View>
        {caption ? <Txt v="tSm">{caption}</Txt> : null}
      </View>
      {children}
    </Surface>
  );
}

// ───────────────────────── Skeleton (yuklanish) ─────────────────────────

function SkBox({ h, r = radius.card, inverse, style }: { h: number; r?: number; inverse?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: h, borderRadius: r, borderCurve: 'continuous', overflow: 'hidden' }, style]}><Shimmer inverse={inverse} /></View>;
}

/**
 * Dashboard skeleti — demo `.screen.loading`: hero, KPI 2×2, tezkor amallar va ro'yxat shakllari shimmer bilan.
 * Ma'lumot kelgach ekran `Stagger` bilan ketma-ket kiradi.
 */
export function SkeletonDashboard({ chips = false, hero = true, kpis = 4, actions = 4, rows = 3, style }: { chips?: boolean; hero?: boolean; kpis?: number; actions?: number; rows?: number; style?: StyleProp<ViewStyle> }) {
  const kpiRows = Math.ceil(kpis / 2);
  return (
    <View style={[{ gap: space.stack }, style]} accessibilityLabel="Yuklanmoqda" accessibilityRole="progressbar">
      {chips ? <SkBox h={size.chip + size.chipPad * 2} r={radius.pill} /> : null}
      {hero ? <SkBox h={172} r={radius.hero} inverse /> : null}
      {Array.from({ length: kpiRows }).map((_, i) => (
        <View key={`k${i}`} style={{ flexDirection: 'row', gap: space.tight }}>
          <SkBox h={80} style={{ flex: 1 }} />
          <SkBox h={80} style={{ flex: 1 }} />
        </View>
      ))}
      {actions ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {Array.from({ length: 4 }).map((_, i) => <SkBox key={i} h={88} r={radius.action} style={{ flex: 1, opacity: i < actions ? 1 : 0 }} />)}
        </View>
      ) : null}
      {rows ? <SkBox h={rows * 64} /> : null}
    </View>
  );
}

/**
 * Ekran tanasi (demo "Animatsiya v2"): `loading` paytida skelet (standart `SkeletonDashboard`), ma'lumot kelgach
 * bolalar ketma-ket kiradi (opacity + translateY 14 + scale .98, 60 ms qadam). `replay` o'zgarsa (tab/davr) qayta o'ynaydi.
 */
export function Reveal({ loading, skeleton, children, gap = space.stack, replay, dx, style }: { loading?: boolean; skeleton?: React.ReactNode; children: React.ReactNode; gap?: number; replay?: unknown; /** Tab almashganda ±24. */ dx?: number; style?: StyleProp<ViewStyle> }) {
  if (loading) return <View style={style}>{skeleton ?? <SkeletonDashboard />}</View>;
  return <Stagger gap={gap} replay={replay} dx={dx} style={style}>{children}</Stagger>;
}

/** Ro'yxat skeleti — ListGroup shaklida `rows` qator (64 dp): plitka + ikki chiziq. */
export function SkeletonList({ rows = 5, style }: { rows?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous' }, elevation(c).sh1, style]} accessibilityLabel="Yuklanmoqda">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.card }}>
          <SkBox h={size.tile} r={radius.tile} style={{ width: size.tile }} />
          <View style={{ flex: 1, gap: space.sm }}>
            <SkBox h={12} r={radius.pill} style={{ width: '62%' }} />
            <SkBox h={10} r={radius.pill} style={{ width: '40%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── Tanlagichlar ─────────────────────────

/**
 * Davr / filtr chiplari — demo `.chips`: bitta yuza trek (bgSurface, sh1, pill, padding 4) ichida 40 dp shaffof chiplar
 * (textMuted), faol yozuv textOnBrand — ostida brend indikator (nur bilan) prujina bilan suriladi.
 * 4 tadan ko'p bo'lsa aylanadi. `count` — chip yonidagi son.
 */
export function ChipGroup<K extends string>({ items, value, onChange, scroll, style }: {
  items: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (k: K) => void;
  /** Majburan aylanuvchi (standart: 4 tadan ko'p bo'lsa). */ scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <SegmentTrack items={items} value={value} onChange={onChange} variant="brand" scroll={scroll} style={style} />;
}

/** Segment boshqaruvi (Sozlamalar: Tizim / Yorug' / Qorong'i) — to'liq enli, ikonka ixtiyoriy. */
export function SegmentedControl<K extends string>({ items, value, onChange, style }: {
  items: { key: K; label: string; icon?: IconName }[];
  value: K;
  onChange: (k: K) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return <SegmentTrack items={items} value={value} onChange={onChange} variant="surface" scroll={false} style={style} />;
}

/**
 * Almashtirgich (switch) — 52×32, prujinali. `label` berilsa — butun qator bosiladi (min 44).
 */
export function Toggle({ value, onChange, label, hint, disabled, style }: {
  value: boolean;
  onChange: (v: boolean) => void;
  /** Yonidagi yorliq (qator ko'rinishi). */ label?: string;
  /** Yorliq ostidagi izoh. */ hint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const W = space.x12 + 4, H = space.xxxl, K = H - 6;
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => { p.value = reduce ? (value ? 1 : 0) : withSpring(value ? 1 : 0, SPRING_SLIDE); }, [value, p, reduce]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: 3 + p.value * (W - K - 6) }] }));
  const onTrack = useAnimatedStyle(() => ({ opacity: p.value }));
  const toggle = () => { if (disabled) return; haptic.selection(); onChange(!value); };
  const sw = (
    <View style={{ width: W, height: H, borderRadius: radius.pill, backgroundColor: c.borderStrong, justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: W, height: H, borderRadius: radius.pill, backgroundColor: c.brand }, onTrack]} />
      <Animated.View style={[{ width: K, height: K, borderRadius: radius.pill, backgroundColor: c.textOnSolid }, elevation(c).sh1, knob]} />
    </View>
  );
  return (
    <Pressable
      onPress={toggle} disabled={disabled}
      accessibilityRole="switch" accessibilityState={{ checked: value, disabled: !!disabled }} accessibilityLabel={label}
      hitSlop={label ? undefined : (size.touch - H) / 2}
      style={[label ? { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.touch, paddingVertical: space.sm } : { alignSelf: 'flex-start' }, disabled && { opacity: 0.5 }, style]}
    >
      {label ? (
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong">{label}</Txt>
          {hint ? <Txt v="caption">{hint}</Txt> : null}
        </View>
      ) : null}
      {sw}
    </Pressable>
  );
}

// ───────────────────────── StickyActionBar ─────────────────────────

export interface StickyPrimary {
  title: string;
  icon?: IconName;
  onPress: () => void;
  /** Yopiq: tugma kulrang ko'rinadi, lekin bosiladi va sababini ko'rsatadi. */ disabled?: boolean;
  /** Nega yopiq: "Avval yuk rasmini yuklang". */ disabledReason?: string;
  loading?: boolean;
  variant?: 'primary' | 'success' | 'danger';
}

/**
 * Pastki amal paneli — demo `.sticky`: fonsiz (ekran foni ko'rinadi), padding 12×16, pill tugmalar 60 dp (44 css):
 * asosiy — brend + nur soyasi (flex 1.4); ikkilamchi — yuza + sh1 (flex 1); `more` — 60 dp doira.
 * `xl` — haydovchi rejimi (76 dp, 56 css). Yopiq asosiy tugma bosilganda `disabledReason`ni toast'da aytadi (jim turmaydi).
 */
export function StickyActionBar({ primary, secondary, more, xl, style }: {
  primary: StickyPrimary;
  /** Ikkilamchi amal: "Rad etish", "Qo'ng'iroq". `tone: 'danger'` — matni qizil. */ secondary?: { title: string; icon?: IconName; onPress: () => void; tone?: 'danger' };
  /** Qo'shimcha amallar menyusi. */ more?: { label: string; icon?: IconName; onPress: () => void };
  /** Haydovchi: bitta katta tugma (76 dp). */ xl?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const locked = !!primary.disabled;
  const press = () => {
    if (locked) {
      haptic.warning();
      toast.warning(primary.disabledReason ?? 'Bu amal hozircha mavjud emas');
      return;
    }
    primary.onPress();
  };
  const sz = xl ? 'stickyXl' as const : 'sticky' as const;
  const h = xl ? size.stickyButtonXl : size.stickyButton;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.tight, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.lg) + space.xs }, style]}>
      {more ? <IconButton icon={more.icon ?? 'ellipsis'} label={more.label} onPress={more.onPress} variant="secondary" size={h} tone="strong" /> : null}
      {secondary ? (
        <View style={{ flex: 1 }}>
          <Button title={secondary.title} icon={secondary.icon} onPress={secondary.onPress} variant="secondary" size={sz} textColor={secondary.tone === 'danger' ? c.danger : undefined} />
        </View>
      ) : null}
      <View style={{ flex: secondary ? 1.4 : 1 }}>
        <Button
          title={primary.title}
          icon={locked ? 'lock' : primary.icon}
          size={sz}
          variant={locked ? 'secondary' : primary.variant ?? 'primary'}
          loading={primary.loading}
          onPress={press}
          accessibilityHint={locked ? primary.disabledReason : undefined}
          style={locked ? { opacity: 0.6 } : undefined}
        />
      </View>
    </View>
  );
}

// ───────────────────────── OfflineBanner ─────────────────────────

/**
 * Oflayn plashka (faqat ko'rinish — holatni chaqiruvchi beradi): "Internet yo'q · 3 ta amal navbatda" + "Qayta".
 * `visible=false` bo'lsa hech narsa chizilmaydi.
 */
export function OfflineBanner({ visible, pendingCount = 0, onRetry, title = "Internet yo'q", style }: {
  visible: boolean;
  /** Navbatdagi (yuborilmagan) amallar soni. */ pendingCount?: number;
  onRetry?: () => void;
  title?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  if (!visible) return null;
  const sub = pendingCount > 0 ? `${pendingCount} ta amal navbatda — aloqa tiklanganda yuboriladi` : "Ma'lumotlar oxirgi saqlangan holatda";
  return (
    <Appear from={-8} scale={1} style={style}>
      <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.warningBg, borderRadius: radius.card, borderCurve: 'continuous', paddingVertical: space.sm, paddingLeft: space.md, paddingRight: onRetry ? space.xs : space.md, minHeight: size.touch + space.sm }}>
        <Icon name="wifi-off" size={size.iconMd} color={c.warning} />
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong" color="warning" numberOfLines={1}>{title}</Txt>
          <Txt v="caption" color="body" numberOfLines={2}>{sub}</Txt>
        </View>
        {onRetry ? (
          <Pressable onPress={() => { haptic.light(); onRetry(); }} accessibilityRole="button" accessibilityLabel="Qayta urinish" hitSlop={space.xs}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: size.touch, paddingHorizontal: space.md, borderRadius: radius.pill }, pressed && { backgroundColor: c.bgSurface }]}>
            <Icon name="refresh-cw" size={size.iconSm} color={c.warning} />
            <Txt v="label" color="warning" style={{ fontFamily: FONT[700] }}>Qayta</Txt>
          </Pressable>
        ) : null}
      </View>
    </Appear>
  );
}
