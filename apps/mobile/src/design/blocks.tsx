/**
 * Ekran bloklari — dashboard va kartochka sahifalari shu "g'ishtlar"dan yig'iladi.
 * Hammasi `useTheme().c` ranglari, `tokens` o'lchamlari va `<Txt v=…>` shriftlari bilan; ekran kodida
 * rang/o'lcham yozilmaydi. Grafiklarda matn faqat matn tokenlarida (seriya rangida emas).
 *
 * Yumshoq qatlam: chegara o'rniga soya, katta radius, pill tugmalar, ichki ajratuvchilar.
 * Harakat: bosish — prujina 0.96 + haptika; kirish — ketma-ket; raqamlar sanab chiqadi; ustunlar o'sadi.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { Icon, IconName } from './icons';
import { Appear, DUR, EASE_STATE, PressScale, SPRING_SLIDE, haptic, stagger, useCountUp } from './motion';
import { Badge, Button, Delta, IconButton, IconTile, KPICard, ListGroup, ListItem, SectionHead, Txt, TxtColor, fmtNum } from './primitives';
import { Avatar, SegmentTrack, fmtShort, toast } from './ui';
import { FONT, ModuleTone, Palette, Tone, TypeVariant, radius, shadow, size, space, toneColors } from './tokens';

export { SectionHead, ListGroup, Delta };

// ───────────────────────── Yordamchilar ─────────────────────────

/** Grafik o'qi uchun "chiroyli" maksimum: 1, 2, 2.5, 5, 10 × 10ⁿ. */
export function niceMax(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * exp;
}

const CHART_KEYS = ['chart1', 'chart2', 'chart3', 'chart4'] as const;
const seriesColor = (c: Palette, i: number) => c[CHART_KEYS[i % CHART_KEYS.length]!];

/** Element kengligini o'lchaydi (grafiklar, sparkline). */
function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => { const n = Math.round(e.nativeEvent.layout.width); if (n !== w) setW(n); }];
}

/** 0 → 1 o'sish (kirishda bir marta, `deps` o'zgarsa qayta). Harakat kamaytirilgan bo'lsa darhol 1. */
function useGrow(delay = 0, deps: unknown[] = []) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) { p.value = 1; return; }
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: DUR.enter + 280, easing: EASE_STATE }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, delay, ...deps]);
  return p;
}

/** Yumshoq karta yuzasi (chegarasiz, soya). */
function Surface({ children, style, pad = space.card }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: number }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', padding: pad }, shadow.card, style]}>{children}</View>;
}

/** Karta sarlavhasi: nom + birlik izohi (o'ngda). */
function CardTitle({ title, unit, right }: { title: string; unit?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginBottom: space.md }}>
      <Txt v="titleSm" numberOfLines={1} style={{ flexShrink: 1 }}>{title}</Txt>
      {right ?? (unit ? <Txt v="caption" color="muted">{unit}</Txt> : null)}
    </View>
  );
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
  /** Son yoki nuqta nishoni (bildirishnomalar). */ badge?: number | boolean;
}

/**
 * Sahifa sarlavhasi — bgApp fonida (sticky uchun mos): tepada overline (sana/rol), ostida titleLg sarlavha;
 * o'ngda doira ikonka-tugmalar va avatar. Sarlavha sahifada bitta.
 */
export function PageHeader({ overline, title, avatar, onAvatar, actions, style }: {
  /** Kichik ustki yozuv: "Dushanba, 3 oktyabr". */ overline?: string;
  /** Sahifa nomi yoki salom. */ title: string;
  /** Profil: rasm yoki ism (bosh harflar). */ avatar?: { name?: string; uri?: string };
  /** Avatar bosilganda (profil). */ onAvatar?: () => void;
  /** O'ngdagi tugmalar (ko'pi bilan 2 ta tavsiya). */ actions?: HeaderAction[];
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const av = avatar ? <Avatar name={avatar.name} uri={avatar.uri} size={size.avatar} tone="brand" /> : null;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.md, backgroundColor: c.bgApp }, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {overline ? <Txt v="overline" numberOfLines={1}>{overline}</Txt> : null}
        <Txt v="titleLg" numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header">{title}</Txt>
      </View>
      {actions?.map((a) => <IconButton key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} badge={a.badge} variant="secondary" tone="strong" />)}
      {av ? (onAvatar ? <PressScale onPress={onAvatar} accessibilityRole="button" accessibilityLabel={avatar?.name ?? 'Profil'} hitSlop={space.xs}>{av}</PressScale> : av) : null}
    </View>
  );
}

// ───────────────────────── HeroCard ─────────────────────────

/** Sparkline: maydon (gradient) + chiziq + oxirgi nuqta. Masshtab — min..max, chap-o'ngga chiziladi. */
function Sparkline({ data, color, height = 56 }: { data: number[]; color: string; height?: number }) {
  const [w, onLayout] = useWidth();
  const gid = `spark${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reveal = useGrow(DUR.stagger * 2, [data.join(',')]);
  const clip = useAnimatedStyle(() => ({ width: `${reveal.value * 100}%` }));
  const geo = useMemo(() => {
    if (w <= 0 || data.length < 2) return null;
    const padX = 5, padTop = 6, padBottom = 4;
    const min = Math.min(...data), max = Math.max(...data);
    const span = max - min || 1;
    const pts = data.map((v, i) => ({
      x: padX + (i * (w - padX * 2)) / (data.length - 1),
      y: padTop + (1 - (v - min) / span) * (height - padTop - padBottom),
    }));
    // Silliq egri: boshqaruv nuqtalari qo'shni nuqtalar o'rtasida (x), y — o'z qiymati: o'sish/tushish oshib ketmaydi
    let line = `M${pts[0]!.x},${pts[0]!.y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!;
      const mx = (a.x + b.x) / 2;
      line += ` C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
    }
    const last = pts[pts.length - 1]!;
    const area = `${line} L${last.x},${height} L${pts[0]!.x},${height} Z`;
    return { line, area, last };
  }, [w, data, height]);
  return (
    <View onLayout={onLayout} style={{ height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {geo ? (
        <Animated.View style={[{ height, overflow: 'hidden' }, clip]}>
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.32} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={geo.area} fill={`url(#${gid})`} />
            <Path d={geo.line} stroke={color} strokeWidth={2.25} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={geo.last.x} cy={geo.last.y} r={6} fill={color} fillOpacity={0.25} />
            <Circle cx={geo.last.x} cy={geo.last.y} r={3.5} fill={color} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Bosh ko'rsatkich kartasi — to'q (bgInverse) fon, aksent chiziqcha, sanab chiqadigan katta raqam,
 * o'zgarish nishoni, sparkline va davr tanlagich. Sahifada bitta.
 */
export function HeroCard({ label, value, unit, format, delta, spark, periods, period = 0, onPeriod, children, style }: {
  /** Ustki yozuv: "Bugungi tushum". */ label: string;
  /** Raqam — sanab chiqadi; satr — o'zicha ko'rsatiladi. */ value: number | string;
  /** Birlik: "so'm", "m³". */ unit?: string;
  /** Raqam formati (standart `fmtNum`). */ format?: (n: number) => string;
  /** O'zgarish: `{ text: '+12% kechagiga', dir: 'up', tone: 'success' }`. */ delta?: { text: string; dir: 'up' | 'down'; tone: Tone };
  /** Sparkline nuqtalari (eng kamida 2). */ spark?: number[];
  /** Davr nomlari: ['Kun', 'Hafta', 'Oy']. */ periods?: string[];
  /** Tanlangan davr indeksi. */ period?: number;
  onPeriod?: (i: number) => void;
  /** Karta ostiga qo'shimcha (masalan kichik statistikalar). */ children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const fmt = format ?? ((n: number) => fmtNum(n));
  const counted = useCountUp(typeof value === 'number' ? value : 0, { format: fmt, duration: 1000 });
  const shown = typeof value === 'number' ? counted : value;
  const lift = Platform.select<ViewStyle>({
    ios: { shadowColor: c.bgInverse, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 12 } },
    android: { elevation: 6, shadowColor: c.bgInverse },
    default: {},
  })!;
  const deltaCol = delta ? (delta.tone === 'neutral' ? c.textOnInverseMuted : c.textOnInverse) : c.textOnInverse;
  return (
    <View
      style={[{ backgroundColor: c.bgInverse, borderRadius: radius.card + 4, borderCurve: 'continuous', padding: space.xl, gap: space.md }, lift, style]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md }}>
        <View style={{ flex: 1, gap: space.sm, paddingTop: space.xs }}>
          <View style={{ width: space.x7, height: 3, borderRadius: radius.pill, backgroundColor: c.accent }} />
          <Txt v="overline" numberOfLines={1} style={{ color: c.textOnInverseMuted }}>{label}</Txt>
        </View>
        {periods?.length ? (
          <SegmentTrack compact variant="inverse" scroll={false} items={periods.map((p, i) => ({ key: String(i), label: p }))} value={String(period)} onChange={(k) => onPeriod?.(Number(k))} />
        ) : null}
      </View>
      <View accessible accessibilityLabel={`${label}: ${typeof value === 'number' ? fmt(value) : value}${unit ? ` ${unit}` : ''}${delta ? `, ${delta.text}` : ''}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, flexWrap: 'wrap' }}>
        <Txt v="metricHero" numberOfLines={1} adjustsFontSizeToFit style={{ color: c.textOnInverse, flexShrink: 1 }}>{shown}</Txt>
        {unit ? <Txt v="bodyStrong" style={{ color: c.textOnInverseMuted, marginBottom: space.xs }}>{unit}</Txt> : null}
      </View>
      {delta ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, paddingHorizontal: space.sm, minHeight: space.xxl, borderRadius: radius.pill, backgroundColor: c.bgInverseChip }}>
          <Icon name={delta.dir === 'down' ? 'arrow-down-right' : 'arrow-up-right'} size={size.iconSm - 2} color={delta.tone === 'danger' || delta.tone === 'warning' ? c.accent : deltaCol} strokeWidth={2.25} />
          <Txt v="caption" style={{ color: deltaCol, fontFamily: FONT[600] }}>{delta.text}</Txt>
        </View>
      ) : null}
      {spark && spark.length > 1 ? <Sparkline data={spark} color={c.accent} /> : null}
      {children}
    </View>
  );
}

// ───────────────────────── KpiGrid ─────────────────────────

export interface KpiItem {
  label: string;
  /** Raqam — sanab chiqadi (`fmtNum`); satr — o'zicha. */ value: number | string;
  delta?: { text: string; tone: Tone };
  /** Qiymat rangi (xavf/ogohlantirish). */ tone?: Tone;
  icon: IconName;
  module?: ModuleTone;
  onPress?: () => void;
}

function KpiTile({ item, index }: { item: KpiItem; index: number }) {
  const counted = useCountUp(typeof item.value === 'number' ? item.value : 0, { format: (n) => fmtNum(n), delay: stagger(index) });
  return (
    <KPICard
      layout="inline" label={item.label} value={typeof item.value === 'number' ? counted : item.value}
      icon={item.icon} module={item.module} tone={item.tone} delta={item.delta} onPress={item.onPress}
      style={{ flex: 1 }}
    />
  );
}

/** 2 ustunli ixcham KPI plitkalari (ikonka chapda, yonida yorliq + qiymat). Ketma-ket kirib keladi. */
export function KpiGrid({ items, style }: { items: KpiItem[]; style?: StyleProp<ViewStyle> }) {
  const rows: KpiItem[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={[{ gap: space.grid }, style]}>
      {rows.map((r, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: space.grid }}>
          {r.map((it, ci) => (
            <Appear key={it.label} delay={stagger(ri * 2 + ci)} style={{ flex: 1 }}>
              <KpiTile item={it} index={ri * 2 + ci} />
            </Appear>
          ))}
          {r.length < 2 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── ActionGrid ─────────────────────────

export interface ActionItem { label: string; icon: IconName; module?: ModuleTone; onPress: () => void }

/** Tezkor amallar — 4 ustun; birinchisi asosiy (brend fon). Yorliq 2 qatorgacha. */
export function ActionGrid({ items, style }: { items: ActionItem[]; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const rows: ActionItem[][] = [];
  for (let i = 0; i < items.length; i += 4) rows.push(items.slice(i, i + 4));
  return (
    <View style={[{ gap: space.sm + 2 }, style]}>
      {rows.map((r, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: space.sm + 2 }}>
          {r.map((a, ci) => {
            const primary = ri === 0 && ci === 0;
            return (
              <Appear key={a.label} delay={stagger(ri * 4 + ci)} style={{ flex: 1 }}>
                <PressScale
                  onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label}
                  style={[{ flex: 1, borderRadius: radius.card + 2, borderCurve: 'continuous', backgroundColor: primary ? c.brand : c.bgSurface }, shadow.card]}
                >
                  <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.xs, minHeight: size.driverTouch + space.lg }}>
                    {primary ? (
                      <View style={{ width: size.iconTile, height: size.iconTile, alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ position: 'absolute', width: size.iconTile, height: size.iconTile, borderRadius: radius.lg, backgroundColor: c.textOnBrand, opacity: 0.2 }} />
                        <Icon name={a.icon} size={size.iconMd} color={c.textOnBrand} strokeWidth={1.75} />
                      </View>
                    ) : <IconTile icon={a.icon} module={a.module} />}
                    <Txt v="caption" align="center" numberOfLines={2} style={{ color: primary ? c.textOnBrand : c.textBody, fontFamily: FONT[600] }}>{a.label}</Txt>
                  </View>
                </PressScale>
              </Appear>
            );
          })}
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

/** "Diqqat talab" ro'yxati — ListGroup ichida, ichki chiziqlar; o'ngda qiymat + nishon. */
export function AttentionList({ items, style }: { items: AttentionItem[]; style?: StyleProp<ViewStyle> }) {
  return (
    <ListGroup style={style}>
      {items.map((it, i) => (
        <ListItem
          key={`${it.title}-${i}`} title={it.title} subtitle={it.sub} subtitleLines={1}
          icon={it.icon} module={it.module} onPress={it.onPress}
          right={it.value || it.badge ? (
            <View style={{ alignItems: 'flex-end', gap: space.xs, maxWidth: '45%' }}>
              {it.value ? <Txt v="bodyStrong" numberOfLines={1}>{it.value}</Txt> : null}
              {it.badge ? <Badge label={it.badge.text} tone={it.badge.tone} /> : null}
            </View>
          ) : undefined}
        />
      ))}
    </ListGroup>
  );
}

// ───────────────────────── Grafiklar ─────────────────────────

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.md }}>
      {items.map((l) => (
        <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
          <View style={{ width: size.dot + 2, height: size.dot + 2, borderRadius: radius.pill, backgroundColor: l.color }} />
          <Txt v="caption" color="body">{l.label}</Txt>
        </View>
      ))}
    </View>
  );
}

function Bar({ h, color, width, delay }: { h: number; color: string; width: number; delay: number }) {
  const p = useGrow(delay, [h]);
  const s = useAnimatedStyle(() => ({ height: Math.max(h > 0 ? 3 : 0, h * p.value) }));
  return <Animated.View style={[{ width, borderTopLeftRadius: width / 2, borderTopRightRadius: width / 2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: color }, s]} />;
}

/**
 * Ustunli grafik kartasi — 1–2 seriya, legenda, "chiroyli" maksimumli setka (0, o'rta, maks),
 * yumaloq ustun uchlari, ustunlar pastdan o'sib chiqadi. Nuqtalarda raqam yo'q (o'q yozuvlari yetadi).
 */
export function BarChartCard({ title, unit, labels, series, height = 148, format = (n: number) => fmtShort(n), style }: {
  title: string;
  /** Birlik izohi (o'ngda): "mln so'm", "m³". */ unit?: string;
  /** X o'qi yozuvlari. */ labels: string[];
  /** 1–2 seriya; `data` uzunligi `labels` bilan teng. */ series: { name: string; data: number[] }[];
  height?: number;
  /** Y o'qi formati (standart `fmtShort`). */ format?: (n: number) => string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const shown = series.slice(0, 2);
  const max = niceMax(Math.max(0, ...shown.flatMap((s) => s.data)));
  const ticks = [max, max / 2, 0];
  const axisW = space.x10;
  const pair = shown.length > 1;
  const barW = pair ? space.sm + 2 : space.lg;
  const every = labels.length > 8 ? Math.ceil(labels.length / 6) : 1;
  const summary = shown.map((s) => `${s.name}: ${s.data.map((v, i) => `${labels[i]} ${format(v)}`).join(', ')}`).join('; ');
  return (
    <Surface style={style}>
      <CardTitle title={title} unit={unit} />
      {pair || shown.length === 1 ? <Legend items={shown.map((s, i) => ({ label: s.name, color: seriesColor(c, i) }))} /> : null}
      <View accessible accessibilityRole="image" accessibilityLabel={`${title}. ${summary}`}>
        <View style={{ height, flexDirection: 'row' }}>
          {/* Y o'qi yozuvlari */}
          <View style={{ width: axisW, justifyContent: 'space-between' }}>
            {ticks.map((t, i) => <Txt key={i} v="caption" color="faint" numberOfLines={1} style={{ marginTop: i === 0 ? -space.sm : 0, marginBottom: i === ticks.length - 1 ? -space.sm : 0 }}>{format(t)}</Txt>)}
          </View>
          <View style={{ flex: 1 }}>
            {/* Setka: maks, o'rta, 0 */}
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'space-between' }}>
              {ticks.map((_, i) => <View key={i} style={{ height: size.hairline, backgroundColor: i === ticks.length - 1 ? c.borderDefault : c.chartGrid, opacity: i === ticks.length - 1 ? 1 : 0.6 }} />)}
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }}>
              {labels.map((l, i) => (
                <View key={`${l}-${i}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 }}>
                  {shown.map((s, si) => <Bar key={s.name} h={(height * Math.max(0, s.data[i] ?? 0)) / max} color={seriesColor(c, si)} width={barW} delay={stagger(i, 35, 12)} />)}
                </View>
              ))}
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginLeft: axisW, marginTop: space.sm }}>
          {labels.map((l, i) => <Txt key={`${l}-${i}`} v="caption" color="muted" align="center" numberOfLines={1} style={{ flex: 1 }}>{i % every === 0 ? l : ''}</Txt>)}
        </View>
      </View>
    </Surface>
  );
}

function HBar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const p = useGrow(delay, [pct]);
  const s = useAnimatedStyle(() => ({ width: `${pct * p.value}%` }));
  return <Animated.View style={[{ height: '100%', borderRadius: radius.pill, backgroundColor: color }, s]} />;
}

/** Gorizontal ustunlar ro'yxati — yorliq + qiymat, ostida eng kattasiga nisbatan chiziq (chart1). */
export function HBarList({ title, unit, items, format = (n: number) => fmtNum(n), style }: {
  title: string; unit?: string;
  items: { label: string; value: number }[];
  /** Qiymat formati (standart `fmtNum`). */ format?: (n: number) => string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <Surface style={style}>
      <CardTitle title={title} unit={unit} />
      <View style={{ gap: space.md }}>
        {items.map((it, i) => (
          <View key={`${it.label}-${i}`} accessible accessibilityLabel={`${it.label}: ${format(it.value)}${unit ? ` ${unit}` : ''}`}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginBottom: space.xs + 2 }}>
              <Txt v="bodySm" numberOfLines={1} style={{ flex: 1 }}>{it.label}</Txt>
              <Txt v="bodyStrong">{format(it.value)}</Txt>
            </View>
            <View style={{ height: size.progress + 2, borderRadius: radius.pill, backgroundColor: c.chartTrack, overflow: 'hidden' }}>
              <HBar pct={(Math.max(0, it.value) / max) * 100} color={c.chart1} delay={stagger(i)} />
            </View>
          </View>
        ))}
      </View>
    </Surface>
  );
}

/**
 * Taqsimot kartasi — segmentli chiziq (4 rang + "Boshqa") va 2 ustunli legenda: nuqta, nom, ulush, qiymat.
 * Beshinchi rang yo'q: 4 tadan ortig'i "Boshqa"ga yig'iladi (kulrang).
 */
export function BreakdownCard({ title, items, unit, format = (n: number) => fmtShort(n), otherLabel = 'Boshqa', style }: {
  title: string;
  items: { label: string; value: number }[];
  unit?: string;
  /** Qiymat formati (standart `fmtShort`). */ format?: (n: number) => string;
  otherLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((s, r) => s + r.value, 0);
  const rows = rest > 0 ? [...top, { label: otherLabel, value: rest }] : top;
  const sum = rows.reduce((s, r) => s + r.value, 0) || 1;
  const color = (i: number) => (i < 4 ? seriesColor(c, i) : c.textFaint);
  const grow = useGrow(DUR.stagger, [rows.map((r) => r.value).join(',')]);
  const bar = useAnimatedStyle(() => ({ width: `${grow.value * 100}%` }));
  return (
    <Surface style={style}>
      <CardTitle title={title} unit={unit} />
      <View style={{ height: space.md, borderRadius: radius.pill, backgroundColor: c.chartTrack, overflow: 'hidden' }} accessibilityElementsHidden>
        <Animated.View style={[{ flexDirection: 'row', height: '100%', gap: 2 }, bar]}>
          {rows.map((r, i) => <View key={r.label} style={{ flex: r.value, backgroundColor: color(i), borderRadius: 2 }} />)}
        </Animated.View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md, rowGap: space.md }}>
        {rows.map((r, i) => (
          <View key={r.label} accessible accessibilityLabel={`${r.label}: ${Math.round((r.value / sum) * 100)}%, ${format(r.value)}`} style={{ width: '50%', flexDirection: 'row', gap: space.sm, paddingRight: space.sm }}>
            <View style={{ width: size.dot + 2, height: size.dot + 2, borderRadius: radius.pill, backgroundColor: color(i), marginTop: space.xs + 1 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="caption" color="muted" numberOfLines={1}>{r.label}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
                <Txt v="bodyStrong">{`${Math.round((r.value / sum) * 100)}%`}</Txt>
                <Txt v="caption" color="faint" numberOfLines={1} style={{ flexShrink: 1 }}>{format(r.value)}</Txt>
              </View>
            </View>
          </View>
        ))}
      </View>
    </Surface>
  );
}

/** Reja bajarilishi kartasi — nom, katta foiz, o'sib chiqadigan chiziq, izoh. 100% — yashil. */
export function ProgressCard({ title, value, caption, tone, style }: {
  title: string;
  /** 0–100. */ value: number;
  /** Ostidagi izoh: "86 / 120 m³". */ caption?: string;
  /** Rang (standart: 100% bo'lsa success, aks holda brand). */ tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const t: Tone = tone ?? (pct >= 100 ? 'success' : 'brand');
  const fill = t === 'brand' ? c.brand : toneColors(c, t).solid;
  const shown = useCountUp(pct, { format: (n) => `${Math.round(n)}%` });
  return (
    <Surface style={style}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={title} accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          <Txt v="titleSm" numberOfLines={1} style={{ flex: 1 }}>{title}</Txt>
          <Txt v="metric" color={t === 'success' ? 'success' : t === 'danger' ? 'danger' : t === 'warning' ? 'warning' : 'strong'}>{shown}</Txt>
        </View>
        <View style={{ height: size.progress + 2, borderRadius: radius.pill, backgroundColor: c.chartTrack, overflow: 'hidden', marginTop: space.md }}>
          <HBar pct={pct} color={fill} delay={DUR.stagger} />
        </View>
        {caption ? <Txt v="caption" style={{ marginTop: space.sm }}>{caption}</Txt> : null}
      </View>
    </Surface>
  );
}

// ───────────────────────── Tanlagichlar ─────────────────────────

/**
 * Filtr chiplari — oq trek (soya) ichida suzuvchi brend indikator. 4 tadan ko'p bo'lsa aylanadi.
 * `count` — chip yonidagi son.
 */
export function ChipGroup<K extends string>({ items, value, onChange, style }: {
  items: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (k: K) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return <SegmentTrack items={items} value={value} onChange={onChange} variant="brand" style={style} />;
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
      <Animated.View style={[{ width: K, height: K, borderRadius: radius.pill, backgroundColor: c.textOnSolid }, shadow.card, knob]} />
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
 * Pastki amal paneli — ekran pastida (ScrollView'dan keyin, flex ustun ichida), bgApp ustida suzadi,
 * xavfsiz hududni hisobga oladi. Asosiy tugma katta pill; ikkilamchi — yonida; `more` — doira tugma.
 * Yopiq asosiy tugma o'rnida qoladi va bosilganda `disabledReason`ni toast'da aytadi (jim turmaydi).
 */
export function StickyActionBar({ primary, secondary, more, style }: {
  primary: StickyPrimary;
  /** Ikkilamchi amal: "Bekor", "Qo'ng'iroq". */ secondary?: { title: string; icon?: IconName; onPress: () => void };
  /** Qo'shimcha amallar menyusi. */ more?: { label: string; icon?: IconName; onPress: () => void };
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
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: Math.max(insets.bottom, space.md) + space.xs, backgroundColor: c.bgApp }, style]}>
      {more ? <IconButton icon={more.icon ?? 'ellipsis'} label={more.label} onPress={more.onPress} variant="secondary" size={size.buttonLg} tone="strong" /> : null}
      {secondary ? (
        <View style={{ flexShrink: 1 }}>
          <Button title={secondary.title} icon={secondary.icon} onPress={secondary.onPress} variant="secondary" size="lg" />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Button
          title={primary.title}
          icon={locked ? 'lock' : primary.icon}
          size="lg"
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
