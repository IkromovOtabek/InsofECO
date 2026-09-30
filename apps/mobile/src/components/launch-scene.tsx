import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import Animated, { SharedValue, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { EASE_LOOP, EASE_STATE } from '@/design/motion';
import { illus as K } from '@/design/tokens';

/**
 * Ochilish sahnasi — izometrik qurilish maydoni (kran, ikki bino, poydevor, ekskavator,
 * buldozer, ishchilar). O'zimiz chizganmiz: stok rasm (suv belgili) ilovaga qo'yilmaydi.
 *
 * Har bir qism alohida qatlam (bir xil viewBox'dagi Svg) — shuning uchun ularni
 * alohida jonlantirish mumkin: qavatlar ketma-ket ko'tariladi, kran chelagi tebranadi,
 * ekskavator cho'michi qazadi, buldozer kirib keladi, ishchilar paydo bo'ladi.
 * Hammasi ~1.8 s; "harakatni kamaytirish" yoqilgan bo'lsa sahna darhol tayyor turadi.
 */

// ───────────── Izometrik geometriya (grid birligi → viewBox pikseli) ─────────────
export const SCENE_W = 360;
export const SCENE_H = 336;
const S = 8;
const OX = 180;
const OY = 152;
const COS = 0.866;

type Pt = [number, number];
const P = (x: number, y: number, z: number): Pt => [OX + (x - y) * COS * S, OY + (x + y) * 0.5 * S - z * S];
const pts = (...p: Pt[]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
/** Qatlamni ekran bo'yicha iso o'q yo'nalishida surish uchun (buldozer kirishi). */
const ISO_X: Pt = [COS * S, 0.5 * S];

interface Faces { top: string; left: string; right: string }

/** Quti: ko'rinadigan uch yuza — tepa, +y (chap-old), +x (o'ng-old). */
function Box({ x, y, z, w, d, h, c }: { x: number; y: number; z: number; w: number; d: number; h: number; c: Faces }) {
  return (
    <G>
      <Polygon points={pts(P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h))} fill={c.left} />
      <Polygon points={pts(P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h))} fill={c.right} />
      <Polygon points={pts(P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h))} fill={c.top} />
    </G>
  );
}

const CONCRETE: Faces = { top: K.concrete.top, left: K.concrete.left, right: K.concrete.right };
const SLAB: Faces = { top: K.concrete.slab, left: K.concrete.top, right: K.concrete.left };
const CRANE: Faces = { top: K.crane.top, left: K.crane.left, right: K.crane.right };
const DIGGER: Faces = { top: K.digger.top, left: K.digger.left, right: K.digger.right };
const METAL: Faces = { top: K.metal.top, left: K.metal.left, right: K.metal.right };
const TRACK: Faces = { top: K.metal.right, left: K.metal.track, right: K.metal.track };

/** Bitta qavat: plita + devor + derazalar. `roof` — ustiga yopuvchi plita. */
function Floor({ x, y, z, w, d, roof }: { x: number; y: number; z: number; w: number; d: number; roof?: boolean }) {
  const wy = y + d - 0.25; // +y devor yuzasi
  const wx = x + w - 0.25; // +x devor yuzasi
  const winsX: number[] = [];
  for (let i = x + 0.7; i + 0.9 < x + w - 0.4; i += 1.35) winsX.push(i);
  const winsY: number[] = [];
  for (let i = y + 0.7; i + 0.9 < y + d - 0.4; i += 1.35) winsY.push(i);
  return (
    <G>
      <Box x={x} y={y} z={z} w={w} d={d} h={0.4} c={SLAB} />
      <Box x={x + 0.25} y={y + 0.25} z={z + 0.4} w={w - 0.5} d={d - 0.5} h={2.6} c={CONCRETE} />
      {winsX.map((i) => <Polygon key={`a${i}`} points={pts(P(i, wy, z + 1.1), P(i + 0.9, wy, z + 1.1), P(i + 0.9, wy, z + 2.5), P(i, wy, z + 2.5))} fill={K.concrete.window} />)}
      {winsY.map((i) => <Polygon key={`b${i}`} points={pts(P(wx, i, z + 1.1), P(wx, i + 0.9, z + 1.1), P(wx, i + 0.9, z + 2.5), P(wx, i, z + 2.5))} fill={K.concrete.windowDark} />)}
      {roof ? <Box x={x} y={y} z={z + 3} w={w} d={d} h={0.4} c={SLAB} /> : null}
    </G>
  );
}

/** Ishchi: oyoqlari (fx, fy) nuqtada, ekran pikselida. */
function Worker({ at, vest = K.person.vest }: { at: Pt; vest?: string }) {
  const [fx, fy] = at;
  return (
    <G>
      <Rect x={fx - 1.7} y={fy - 4.2} width={1.4} height={4.2} fill={K.person.pants} />
      <Rect x={fx + 0.3} y={fy - 4.2} width={1.4} height={4.2} fill={K.person.pants} />
      <Rect x={fx - 2.1} y={fy - 9.4} width={4.2} height={5.6} rx={1.2} fill={vest} />
      <Circle cx={fx} cy={fy - 11.1} r={1.8} fill={K.person.skin} />
      <Path d={`M${fx - 2.2} ${fy - 11.3} A2.2 2.2 0 0 1 ${fx + 2.2} ${fy - 11.3} Z`} fill={K.person.helmet} />
    </G>
  );
}

// ───────────── Sahna qismlari ─────────────

function Ground() {
  const lines: React.ReactNode[] = [];
  for (let i = 2; i < 22; i += 2) {
    lines.push(<Line key={`x${i}`} x1={P(i, 0, 0)[0]} y1={P(i, 0, 0)[1]} x2={P(i, 22, 0)[0]} y2={P(i, 22, 0)[1]} stroke={K.ground.grid} strokeWidth={0.6} />);
    lines.push(<Line key={`y${i}`} x1={P(0, i, 0)[0]} y1={P(0, i, 0)[1]} x2={P(22, i, 0)[0]} y2={P(22, i, 0)[1]} stroke={K.ground.grid} strokeWidth={0.6} />);
  }
  return (
    <G>
      <Box x={0} y={0} z={-0.8} w={22} d={22} h={0.8} c={K.ground} />
      {lines}
    </G>
  );
}

const A = { x: 9, y: 1, w: 6, d: 5 };
const B = { x: 1, y: 10, w: 6, d: 5 };

function Crane() {
  const tx = 2, ty = 4, top = 18;
  const zig: Pt[] = [];
  const zig2: Pt[] = [];
  for (let k = 0; k <= top; k += 1) {
    zig.push(P(k % 2 ? tx + 1 : tx, ty + 1, k));
    zig2.push(P(tx + 1, k % 2 ? ty : ty + 1, k));
  }
  const jib: Pt[] = [];
  for (let k = -3, i = 0; k <= 15; k += 1, i++) jib.push(P(2.5, k, i % 2 ? top + 1 : top));
  const line = (a: Pt, b: Pt, w = 1, c: string = K.crane.left) => <Line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={c} strokeWidth={w} strokeLinecap="round" />;
  return (
    <G>
      {/* Poydevor bloki */}
      <Box x={tx - 0.5} y={ty - 0.5} z={0} w={2} d={2} h={0.6} c={METAL} />
      {/* Panjarali minora: ko'rinadigan ikki yuza + zigzag */}
      <Polygon points={pts(P(tx, ty + 1, 0), P(tx + 1, ty + 1, 0), P(tx + 1, ty + 1, top), P(tx, ty + 1, top))} fill={K.crane.left} fillOpacity={0.18} />
      <Polygon points={pts(P(tx + 1, ty, 0), P(tx + 1, ty + 1, 0), P(tx + 1, ty + 1, top), P(tx + 1, ty, top))} fill={K.crane.right} fillOpacity={0.18} />
      <Polyline points={pts(...zig)} fill="none" stroke={K.crane.lattice} strokeWidth={0.7} />
      <Polyline points={pts(...zig2)} fill="none" stroke={K.crane.lattice} strokeWidth={0.7} />
      {line(P(tx, ty + 1, 0), P(tx, ty + 1, top), 1.3, K.crane.left)}
      {line(P(tx + 1, ty + 1, 0), P(tx + 1, ty + 1, top), 1.3, K.crane.left)}
      {line(P(tx + 1, ty, 0), P(tx + 1, ty, top), 1.3, K.crane.right)}
      {/* Kabina va strela */}
      <Box x={tx} y={ty + 1} z={top - 1.6} w={1} d={1} h={1.4} c={CRANE} />
      <Polygon points={pts(P(tx + 0.15, ty + 2, top - 1.3), P(tx + 0.85, ty + 2, top - 1.3), P(tx + 0.85, ty + 2, top - 0.5), P(tx + 0.15, ty + 2, top - 0.5))} fill={K.glass} />
      {line(P(2.5, -3, top), P(2.5, 15, top), 1.4, K.crane.left)}
      {line(P(2.5, -3, top + 1), P(2.5, 13, top + 1), 1.1, K.crane.top)}
      <Polyline points={pts(...jib)} fill="none" stroke={K.crane.lattice} strokeWidth={0.7} />
      {/* Machta va tortqichlar */}
      {line(P(2.5, 4.5, top + 1), P(2.5, 4.5, top + 3.5), 1.3, K.crane.right)}
      {line(P(2.5, 4.5, top + 3.5), P(2.5, -3, top + 1), 0.6, K.rope)}
      {line(P(2.5, 4.5, top + 3.5), P(2.5, 13, top + 1), 0.6, K.rope)}
      {/* Qarshi yuk */}
      <Box x={2} y={-3} z={top - 1.1} w={1} d={1.6} h={1.1} c={METAL} />
      {/* Aravacha */}
      <Box x={2.1} y={11.8} z={top - 0.5} w={0.8} d={1} h={0.5} c={METAL} />
    </G>
  );
}

/** Ilgak nuqtasi — chelak shu nuqta atrofida tebranadi. */
const HOOK = P(2.5, 12.3, 17.5);
function Hook() {
  const end = P(2.5, 12.3, 9.8);
  const [bx, by] = end;
  return (
    <G>
      <Line x1={HOOK[0]} y1={HOOK[1]} x2={bx} y2={by} stroke={K.rope} strokeWidth={0.7} />
      {/* Beton chelagi (bunker) */}
      <Path d={`M${bx - 5} ${by} L${bx + 5} ${by} L${bx + 2} ${by + 7} L${bx - 2} ${by + 7} Z`} fill={K.metal.left} />
      <Path d={`M${bx - 5} ${by} L${bx + 5} ${by} L${bx + 4} ${by + 1.6} L${bx - 4} ${by + 1.6} Z`} fill={K.metal.top} />
      <Rect x={bx - 1} y={by + 7} width={2} height={1.6} fill={K.metal.right} />
    </G>
  );
}

function BTop() {
  const cols: Pt[] = [[1.3, 10.3], [4, 10.3], [6.4, 10.3], [1.3, 12.5], [6.4, 12.5], [1.3, 14.4], [4, 14.4], [6.4, 14.4]];
  return (
    <G>
      {cols.map(([x, y]) => <Box key={`${x}-${y}`} x={x} y={y} z={6.4} w={0.35} d={0.35} h={1.8} c={CONCRETE} />)}
    </G>
  );
}

function Foundation() {
  const cols: React.ReactNode[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const x = 13.8 + i * 2.1, y = 13.8 + j * 2.1;
    cols.push(<Box key={`${i}${j}`} x={x} y={y} z={0.5} w={0.45} d={0.45} h={2.4 + ((i + j) % 2) * 0.8} c={CONCRETE} />);
  }
  return (
    <G>
      <Box x={13} y={13} z={0} w={6} d={6} h={0.5} c={SLAB} />
      {cols}
    </G>
  );
}

function Sand() {
  const [cx, cy] = P(16.5, 9, 0);
  return (
    <G>
      <Path d={`M${cx - 14} ${cy} Q${cx - 4} ${cy - 13} ${cx + 3} ${cy - 8} Q${cx + 10} ${cy - 5} ${cx + 13} ${cy} Z`} fill={K.sand.top} />
      <Path d={`M${cx + 3} ${cy - 8} Q${cx + 10} ${cy - 5} ${cx + 13} ${cy} L${cx + 1} ${cy} Z`} fill={K.sand.shade} />
    </G>
  );
}

function Dozer() {
  return (
    <G>
      <Box x={17} y={5.9} z={0} w={2.6} d={0.45} h={0.7} c={TRACK} />
      <Box x={17} y={7.35} z={0} w={2.6} d={0.45} h={0.7} c={TRACK} />
      <Box x={17.2} y={6.2} z={0.5} w={2.2} d={1.4} h={0.9} c={CRANE} />
      <Box x={17.3} y={6.4} z={1.4} w={1.1} d={1} h={1.1} c={CRANE} />
      <Polygon points={pts(P(18.4, 7.4, 1.55), P(18.4, 6.5, 1.55), P(18.4, 6.5, 2.3), P(18.4, 7.4, 2.3))} fill={K.glass} />
      {/* Pichoq */}
      <Box x={19.8} y={5.6} z={0} w={0.3} d={2.5} h={1} c={METAL} />
    </G>
  );
}

function DiggerBody() {
  return (
    <G>
      <Box x={9} y={11} z={0} w={2.6} d={0.5} h={0.6} c={TRACK} />
      <Box x={9} y={12.2} z={0} w={2.6} d={0.5} h={0.6} c={TRACK} />
      <Box x={9.1} y={11.1} z={0.6} w={2.2} d={1.5} h={0.9} c={DIGGER} />
      <Box x={10.2} y={11.2} z={1.5} w={1.1} d={1} h={1.2} c={DIGGER} />
      <Polygon points={pts(P(11.3, 11.3, 1.7), P(11.3, 12.1, 1.7), P(11.3, 12.1, 2.5), P(11.3, 11.3, 2.5))} fill={K.glass} />
    </G>
  );
}

/** Ekskavator yelkasi — qo'l shu nuqta atrofida aylanadi. */
const SHOULDER = P(11.2, 11.8, 1.4);
function DiggerArm() {
  const knee = P(13.2, 11.8, 3.8);
  const tip = P(14.4, 11.8, 1.2);
  const [tx, ty] = tip;
  return (
    <G>
      <Polyline points={pts(SHOULDER, knee, tip)} fill="none" stroke={K.digger.left} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      <Line x1={SHOULDER[0]} y1={SHOULDER[1]} x2={knee[0]} y2={knee[1]} stroke={K.digger.top} strokeWidth={0.8} strokeLinecap="round" />
      <Path d={`M${tx - 2} ${ty - 1} L${tx + 3} ${ty} L${tx + 1.5} ${ty + 4} L${tx - 2.5} ${ty + 3} Z`} fill={K.metal.left} />
    </G>
  );
}

function Workers() {
  return (
    <G>
      <Worker at={P(4.6, 12.6, 6.4)} />
      <Worker at={P(3.2, 13.8, 6.4)} vest={K.person.vestAlt} />
      <Worker at={P(11.6, 16.2, 0)} />
      <Worker at={P(11.2, 18.2, 0)} vest={K.person.vestAlt} />
    </G>
  );
}

function Surveyor() {
  const foot = P(18, 20.6, 0);
  const tri = P(19.3, 20.2, 0);
  return (
    <G>
      <Line x1={tri[0]} y1={tri[1] - 9} x2={tri[0] - 2.5} y2={tri[1]} stroke={K.metal.top} strokeWidth={0.7} />
      <Line x1={tri[0]} y1={tri[1] - 9} x2={tri[0] + 2.5} y2={tri[1]} stroke={K.metal.top} strokeWidth={0.7} />
      <Line x1={tri[0]} y1={tri[1] - 9} x2={tri[0]} y2={tri[1] + 1} stroke={K.metal.top} strokeWidth={0.7} />
      <Rect x={tri[0] - 1.6} y={tri[1] - 11} width={3.2} height={2} rx={0.5} fill={K.crane.left} />
      <Worker at={foot} />
    </G>
  );
}

function Fence() {
  const posts: React.ReactNode[] = [];
  for (let x = 0.2; x <= 10.3; x += 2) {
    const a = P(x, 21.8, 0), b = P(x, 21.8, 2.2);
    posts.push(<Line key={x} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={K.fence.post} strokeWidth={1.2} />);
  }
  return (
    <G>
      <Polygon points={pts(P(0.2, 21.8, 0), P(10.2, 21.8, 0), P(10.2, 21.8, 2.2), P(0.2, 21.8, 2.2))} fill={K.fence.mesh} fillOpacity={0.14} />
      <Line x1={P(0.2, 21.8, 2.2)[0]} y1={P(0.2, 21.8, 2.2)[1]} x2={P(10.2, 21.8, 2.2)[0]} y2={P(10.2, 21.8, 2.2)[1]} stroke={K.fence.mesh} strokeWidth={0.6} />
      <Line x1={P(0.2, 21.8, 1.1)[0]} y1={P(0.2, 21.8, 1.1)[1]} x2={P(10.2, 21.8, 1.1)[0]} y2={P(10.2, 21.8, 1.1)[1]} stroke={K.fence.mesh} strokeWidth={0.4} />
      {posts}
    </G>
  );
}

// ───────────── Jonlantirish ─────────────

type Enter = 'rise' | 'drop' | 'pop' | 'fade' | 'slide';

/** Bitta qatlam: butun viewBox'ni egallaydi, o'z progress qiymati bilan kiradi. */
function Layer({ p, enter, k, swing, origin, children }: { p: SharedValue<number>; enter: Enter; k: number; swing?: { v: SharedValue<number>; deg: number }; origin?: Pt; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const v = p.value;
    const t: ({ translateX: number } | { translateY: number } | { scale: number } | { rotate: string })[] = [];
    if (enter === 'drop') t.push({ translateY: (1 - v) * -14 * k });
    if (enter === 'rise') t.push({ translateY: (1 - v) * 18 * k });
    if (enter === 'slide') t.push({ translateX: (1 - v) * -ISO_X[0] * 4 * k }, { translateY: (1 - v) * -ISO_X[1] * 4 * k });
    if (enter === 'pop') t.push({ scale: 0.92 + v * 0.08 });
    if (swing && origin) {
      // Aylanish markazi — qatlam markazi emas, ilgak/yelka nuqtasi: surib, aylantirib, qaytaramiz
      const dx = (origin[0] - SCENE_W / 2) * k;
      const dy = (origin[1] - SCENE_H / 2) * k;
      t.push({ translateX: dx }, { translateY: dy }, { rotate: `${swing.v.value * swing.deg}deg` }, { translateX: -dx }, { translateY: -dy });
    }
    return { opacity: v, transform: t };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}>{children}</Svg>
    </Animated.View>
  );
}

/** Kechikish bilan 0→1 (yumshoq egri). */
function useEnter(delay: number, duration: number, reduce: boolean) {
  const v = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) v.value = withDelay(delay, withTiming(1, { duration, easing: EASE_STATE }));
    return () => cancelAnimation(v);
  }, [v, delay, duration, reduce]);
  return v;
}

/** Cheksiz tebranish −1…1 (sinusga yaqin). */
function useSwing(delay: number, period: number, reduce: boolean) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    v.value = withDelay(delay, withSequence(
      withTiming(1, { duration: period / 4, easing: EASE_LOOP }),
      withRepeat(withSequence(withTiming(-1, { duration: period / 2, easing: EASE_LOOP }), withTiming(1, { duration: period / 2, easing: EASE_LOOP })), -1),
    ));
    return () => cancelAnimation(v);
  }, [v, delay, period, reduce]);
  return v;
}

export function LaunchScene({ width }: { width: number }) {
  const reduce = useReducedMotion();
  const k = width / SCENE_W;

  const ground = useEnter(0, 520, reduce);
  const a = [useEnter(160, 460, reduce), useEnter(290, 460, reduce), useEnter(420, 460, reduce), useEnter(550, 460, reduce)];
  const crane = useEnter(240, 620, reduce);
  const b = [useEnter(520, 460, reduce), useEnter(650, 460, reduce)];
  const bTop = useEnter(780, 420, reduce);
  const hook = useEnter(900, 420, reduce);
  const site = useEnter(700, 480, reduce);
  const dozer = useEnter(950, 700, reduce);
  const digger = useEnter(1000, 480, reduce);
  const people = useEnter(1200, 420, reduce);
  const fence = useEnter(400, 520, reduce);

  const bucketSwing = useSwing(1100, 2600, reduce);
  const armSwing = useSwing(1300, 2000, reduce);

  return (
    <View style={{ width, height: width * (SCENE_H / SCENE_W) }} accessible accessibilityLabel="Qurilish maydoni">
      <Layer p={ground} enter="pop" k={k}><Ground /></Layer>
      {a.map((p, i) => (
        <Layer key={`a${i}`} p={p} enter="drop" k={k}><Floor x={A.x} y={A.y} z={i * 3} w={A.w} d={A.d} roof={i === 3} /></Layer>
      ))}
      <Layer p={crane} enter="rise" k={k}><Crane /></Layer>
      {b.map((p, i) => (
        <Layer key={`b${i}`} p={p} enter="drop" k={k}><Floor x={B.x} y={B.y} z={i * 3} w={B.w} d={B.d} roof={i === 1} /></Layer>
      ))}
      <Layer p={bTop} enter="rise" k={k}><BTop /></Layer>
      <Layer p={hook} enter="fade" k={k} swing={{ v: bucketSwing, deg: 3 }} origin={HOOK}><Hook /></Layer>
      <Layer p={site} enter="rise" k={k}><Sand /><Foundation /></Layer>
      <Layer p={dozer} enter="slide" k={k}><Dozer /></Layer>
      <Layer p={digger} enter="pop" k={k}><DiggerBody /></Layer>
      <Layer p={digger} enter="fade" k={k} swing={{ v: armSwing, deg: 6 }} origin={SHOULDER}><DiggerArm /></Layer>
      <Layer p={people} enter="pop" k={k}><Workers /><Surveyor /></Layer>
      <Layer p={fence} enter="fade" k={k}><Fence /></Layer>
    </View>
  );
}
