import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useTheme } from '@/design/theme';
import { alpha, palettes } from '@/design/tokens';
import { DUR, EASE_MICRO, EASE_STATE } from '@/design/motion';

/**
 * Yuz skanerining "iPhone Pro halqa" ko'rinishi: dumaloq "teshik" (atrofi qalin qoraytirilgan), uning atrofida 90 ta
 * radial chiziqcha (tick). Skanerlash va tekshiruvda chiziqchalar uzunligi ovoz to'lqini kabi "nafas oladi"; kadrlar
 * olinishi bilan soat yo'nalishida yonadi (yonganlari nur sochadi), server tekshiruvida halqa bo'ylab och ko'k yorqin
 * "bosh" va undan ortda so'nib boruvchi dum aylanadi, muvaffaqiyatda yashil bo'lib 5% qisqaradi va nurli doira ichida
 * belgi chiziladi, xatoda qizil bo'lib so'nib boruvchi chayqalish bilan silkinadi.
 *
 * Unumdorlik (arzon Android uchun): 90 ta alohida <Line> + animatedProps EMAS. Buning o'rniga:
 *  - barcha chiziqchalar bitta worklet'da (useDerivedValue, UI oqimi) oldindan hisoblangan cos/sin jadvalidan bir
 *    nechta `d` satriga yig'iladi: xira, yongan, tomon ishorasi va tekshiruvdagi 3 ta so'nish "chelagi" (shaffoflik
 *    bo'yicha guruh) — har bir yo'l bitta native prop, JS/React qayta render yo'q;
 *  - to'lqin fazasi useFrameCallback'da faqat skanerlash/tekshiruv paytida oshadi; boshqa paytda kadr hisoblanmaydi;
 *  - nur (glow) — svg'da shadowBlur yo'q: yongan yo'lning o'sha `d` si 3× va 5× qalin, past shaffoflik bilan ortda
 *    chiziladi (bitta yo'l ichidagi kesishmalar qo'shilib ketmaydi);
 *  - qisqarish va chayqalish — View transform (scale/translateX), belgi chizilishi — `strokeDashoffset`.
 * "Kamroq harakat"da to'lqin ham, aylanuvchi bosh ham yo'q: uzunliklar o'zgarmas, ranglar darhol almashadi.
 */

const N = 90;
/** Chap/o'ng tomon ishorasi uchun chiziqchalar soni (≈ 96°). */
const SIDE_TICKS = 24;
/** Tekshiruvda aylanuvchi bosh ortidagi dum uzunligi (chiziqcha) — 4 ta chelakka bo'linadi. */
const TAIL = 18;
/** Chayqalish uchun skrim ekran chetidan shuncha kengroq chiziladi (chet ochilib qolmasin). */
const PAD = 24;
const TAU = 2 * Math.PI;
/** Bo'sh (ko'rinmas) yo'l. */
const EMPTY = 'M-20 -20';

export type RingMode = 'align' | 'scan' | 'verify' | 'ok' | 'fail';

/** Halqa radiusi: teshik uning 86% i (maket bo'yicha). */
const ringR = (r: number) => r / 0.86;
const tickIn = (r: number) => ringR(r) * 0.96;
const tickLen = (r: number) => ringR(r) * 0.13;
const strokeW = (r: number) => Math.max(2, Math.round(r * 0.026 * 2) / 2);

/** Chiziqchalar halqasining tashqi radiusi (to'lqindagi eng uzun chiziqcha bilan) — maket hisoblash uchun (teshik radiusidan). */
export function ringOuter(r: number): number {
  return tickIn(r) + tickLen(r) * 1.3 + strokeW(r) / 2;
}

const APath = Animated.createAnimatedComponent(Path);

export function FaceRing({ W, H, cx, cy, r, mode, target, ms, side, reduce }: {
  W: number;
  H: number;
  cx: number;
  cy: number;
  /** Dumaloq teshik radiusi. */
  r: number;
  mode: RingMode;
  /** Yonib turgan chiziqchalar ulushi (0..1) va unga yetish vaqti (ms). */
  target: number;
  ms: number;
  /** Bosh burish topshirig'ida ekranning qaysi tomoni ishora qilinadi. */
  side: 'left' | 'right' | null;
  reduce: boolean;
}) {
  const { c, paletteName } = useTheme();
  // Skaner har doim kamera ustida, qorong'i fonda — och ko'k va sariq ishora palitraning qorong'i rejimidan olinadi
  const k = (palettes[paletteName] ?? palettes.chizma).dark;
  const rIn = tickIn(r);
  const L = tickLen(r);
  const sw = strokeW(r);
  const S = Math.ceil(2 * (ringOuter(r) + 3 * sw) + 4);
  const o = S / 2;

  // cos/sin jadvali: 0-chiziqcha tepada, soat yo'nalishida
  const [cosT, sinT] = useMemo(() => {
    const cs: number[] = [];
    const sn: number[] = [];
    for (let i = 0; i < N; i++) {
      const t = -Math.PI / 2 + (TAU * i) / N;
      cs.push(Math.cos(t));
      sn.push(Math.sin(t));
    }
    return [cs, sn];
  }, []);
  // Tomon ishorasi boshlanadigan chiziqcha (-1 — yo'q): chap — 270°, o'ng — 90° atrofida
  const sideStart = side ? Math.round((side === 'left' ? (3 * N) / 4 : N / 4) - (SIDE_TICKS - 1) / 2) : -1;

  const prog = useSharedValue(0);
  const spin = useSharedValue(0);
  const wave = useSharedValue(0);
  const speed = useSharedValue(4);
  const phA = useSharedValue(0);
  const phB = useSharedValue(0);
  const shake = useSharedValue(0);
  const scale = useSharedValue(1);
  const disc = useSharedValue(0);
  const draw = useSharedValue(0);
  const sideOp = useSharedValue(0);

  // Yonish ulushi: kadrlar oqimiga bog'langan (ota komponent bosqichga qarab target/ms beradi)
  useEffect(() => {
    prog.value = reduce || ms <= 0 ? target : withTiming(target, { duration: ms, easing: EASE_MICRO });
  }, [target, ms, reduce, prog]);

  // To'lqin: skanerlash va tekshiruvda chiziqchalar uzunligi "nafas oladi" (tekshiruvda tezroq). Faza har kadrda
  // tezlik × vaqt bilan oshadi — tezlik o'zgarganda to'lqin sakramaydi.
  const waving = (mode === 'scan' || mode === 'verify') && !reduce;
  const clock = useFrameCallback((f) => {
    const dt = Math.min(f.timeSincePreviousFrame ?? 16, 50) / 1000;
    phA.value = (phA.value + speed.value * dt) % TAU;
    phB.value = (phB.value + 2 * dt) % TAU;
  }, false);
  useEffect(() => {
    clock.setActive(waving);
    wave.value = reduce ? 0 : withTiming(waving ? 1 : 0, { duration: DUR.screen, easing: EASE_STATE });
    speed.value = withTiming(mode === 'verify' ? 9 : 4, { duration: DUR.screen });
    return () => clock.setActive(false);
  }, [waving, mode, reduce, clock, wave, speed]);

  // Server tekshiruvi — halqa bo'ylab aylanuvchi yorqin bosh ("kamroq harakat"da yo'q)
  const spinning = mode === 'verify' && !reduce;
  useEffect(() => {
    if (spinning) {
      spin.value = 0;
      spin.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(spin);
    }
  }, [spinning, spin]);

  // Natija: muvaffaqiyat — 5% qisqarish + belgi chizilishi; xato — so'nib boruvchi chayqalish + belgi
  useEffect(() => {
    if (mode === 'ok') {
      scale.value = reduce ? 0.95 : withTiming(0.95, { duration: DUR.screen, easing: EASE_STATE });
      disc.value = reduce ? 1 : withTiming(1, { duration: DUR.state, easing: EASE_STATE });
      draw.value = reduce ? 1 : withDelay(DUR.micro, withTiming(1, { duration: 420, easing: EASE_STATE }));
    } else if (mode === 'fail') {
      scale.value = 1;
      disc.value = reduce ? 1 : withTiming(1, { duration: DUR.state, easing: EASE_STATE });
      draw.value = reduce ? 1 : withDelay(DUR.micro, withTiming(1, { duration: DUR.screen, easing: EASE_STATE }));
      if (!reduce) {
        shake.value = withSequence(
          withTiming(-12, { duration: 45 }),
          withTiming(10, { duration: 80 }),
          withTiming(-8, { duration: 75 }),
          withTiming(6, { duration: 70 }),
          withTiming(-4, { duration: 60 }),
          withTiming(2, { duration: 50 }),
          withTiming(0, { duration: 40 }),
        );
      }
    } else {
      cancelAnimation(shake);
      shake.value = 0;
      scale.value = reduce ? 1 : withTiming(1, { duration: DUR.state, easing: EASE_STATE });
      disc.value = 0;
      draw.value = 0;
    }
  }, [mode, reduce, scale, disc, draw, shake]);

  useEffect(() => {
    sideOp.value = reduce ? (side ? 1 : 0) : withTiming(side ? 1 : 0, { duration: DUR.state });
  }, [side, reduce, sideOp]);

  // Barcha chiziqchalar bitta worklet'da: [xira, yongan, chelak1, chelak2, chelak3, tomon]
  const paths = useDerivedValue(() => {
    const amp = wave.value;
    const pa = phA.value;
    const pb = phB.value;
    const litN = Math.round(prog.value * N);
    const head = spinning ? spin.value * N : -1;
    let dim = '';
    let lit = '';
    let b1 = '';
    let b2 = '';
    let b3 = '';
    let sd = '';
    for (let i = 0; i < N; i++) {
      const len = amp > 0 ? L * (1 + amp * (0.6 * Math.abs(Math.sin(i * 0.45 + pa) * Math.sin(i * 0.13 - pb)) - 0.3)) : L;
      const r2 = rIn + len;
      const cs = cosT[i] ?? 0;
      const sn = sinT[i] ?? 0;
      const seg = `M${Math.round((o + rIn * cs) * 10) / 10} ${Math.round((o + rIn * sn) * 10) / 10}L${Math.round((o + r2 * cs) * 10) / 10} ${Math.round((o + r2 * sn) * 10) / 10}`;
      if (head >= 0) {
        // Boshdan ortda qolgan masofa (chiziqcha): yaqinlari yorqinroq
        const d = (head - i + N) % N;
        if (d < TAIL / 4) lit += seg;
        else if (d < TAIL / 2) b1 += seg;
        else if (d < (3 * TAIL) / 4) b2 += seg;
        else if (d < TAIL) b3 += seg;
        else dim += seg;
      } else if (i < litN) {
        lit += seg;
      } else {
        dim += seg;
        if (sideStart >= 0 && (i - sideStart + N) % N < SIDE_TICKS) sd += seg;
      }
    }
    return [dim || EMPTY, lit || EMPTY, b1 || EMPTY, b2 || EMPTY, b3 || EMPTY, sd || EMPTY];
  }, [cosT, sinT, rIn, L, o, spinning, sideStart]);

  const dimProps = useAnimatedProps(() => ({ d: paths.value[0] }));
  const litProps = useAnimatedProps(() => ({ d: paths.value[1] }));
  const glowProps = useAnimatedProps(() => ({ d: paths.value[1] }));
  const haloProps = useAnimatedProps(() => ({ d: paths.value[1] }));
  const b1Props = useAnimatedProps(() => ({ d: paths.value[2] }));
  const b2Props = useAnimatedProps(() => ({ d: paths.value[3] }));
  const b3Props = useAnimatedProps(() => ({ d: paths.value[4] }));
  const sideProps = useAnimatedProps(() => ({ d: paths.value[5], strokeOpacity: sideOp.value }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const discStyle = useAnimatedStyle(() => ({ opacity: disc.value, transform: [{ scale: 0.6 + 0.4 * disc.value }] }));

  // Belgi (galochka yoki xoch) — teshik markazidagi nurli doira ichida
  const rd = Math.round(r * 0.42);
  const rg = Math.round(rd * 1.3);
  const off = rg - rd;
  const D = 2 * rg;
  const markW = Math.max(4, Math.round(rd * 0.13));
  const P = (x: number, y: number) => [rd + x * rd, rd + y * rd] as const;
  const [a1, a2] = P(-0.42, 0.02);
  const [b1x, b1y] = P(-0.12, 0.32);
  const [e1, e2] = P(0.44, -0.3);
  const checkLen = Math.ceil(Math.hypot(b1x - a1, b1y - a2) + Math.hypot(e1 - b1x, e2 - b1y)) + 2;
  const xLen = Math.ceil(0.6 * Math.SQRT2 * rd) + 2;
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: checkLen * (1 - draw.value) }));
  const x1Props = useAnimatedProps(() => ({ strokeDashoffset: xLen * (1 - Math.min(1, draw.value * 2)) }));
  const x2Props = useAnimatedProps(() => ({ strokeDashoffset: xLen * (1 - Math.max(0, draw.value * 2 - 1)) }));
  const lo = P(-0.3, -0.3);
  const hi = P(0.3, 0.3);

  const lit = mode === 'ok' ? c.successSolid : mode === 'fail' ? c.dangerSolid : mode === 'verify' ? k.info : c.textOnSolid;
  // Tekshiruvda butun halqa och ko'k, bosh ortidagilari so'nib boradi; boshqa paytda yonmaganlari xira oq
  const dimColor = spinning ? k.info : c.textOnSolid;
  const dimOp = spinning ? 0.25 : 0.18;
  const done = mode === 'ok' || mode === 'fail';
  const glyph = mode === 'ok' ? c.successSolid : c.dangerSolid;
  const hole = `M0 0H${W + 2 * PAD}V${H}H0Z M${cx + PAD - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
  const tick = { strokeLinecap: 'round' as const, fill: 'none' };

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, shakeStyle]}>
      <Svg width={W + 2 * PAD} height={H} style={{ position: 'absolute', top: 0, left: -PAD }}>
        <Path d={hole} fill={alpha(c.scrim, 0.8)} fillRule="evenodd" />
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: cx - o, top: cy - o, width: S, height: S }, scaleStyle]}>
        <Svg width={S} height={S}>
          <APath animatedProps={dimProps} stroke={dimColor} strokeOpacity={dimOp} strokeWidth={sw} {...tick} />
          {spinning ? (
            <>
              <APath animatedProps={b3Props} stroke={k.info} strokeOpacity={0.42} strokeWidth={sw} {...tick} />
              <APath animatedProps={b2Props} stroke={k.info} strokeOpacity={0.6} strokeWidth={sw} {...tick} />
              <APath animatedProps={b1Props} stroke={k.info} strokeOpacity={0.8} strokeWidth={sw} {...tick} />
            </>
          ) : null}
          <APath animatedProps={haloProps} stroke={lit} strokeOpacity={0.1} strokeWidth={sw * 5} {...tick} />
          <APath animatedProps={glowProps} stroke={lit} strokeOpacity={0.25} strokeWidth={sw * 3} {...tick} />
          <APath animatedProps={litProps} stroke={lit} strokeWidth={sw} {...tick} />
          {sideStart >= 0 ? <APath animatedProps={sideProps} stroke={k.warning} strokeWidth={sw} {...tick} /> : null}
        </Svg>
      </Animated.View>
      {done ? (
        <Animated.View style={[{ position: 'absolute', left: cx - rg, top: cy - rg, width: D, height: D }, discStyle]}>
          <Svg width={D} height={D}>
            <Circle cx={rg} cy={rg} r={rg} fill={glyph} fillOpacity={0.12} />
            <Circle cx={rg} cy={rg} r={Math.round(rd * 1.14)} fill={glyph} fillOpacity={0.22} />
            <Circle cx={rg} cy={rg} r={rd} fill={glyph} fillOpacity={0.92} />
            <G transform={`translate(${off} ${off})`}>
              {mode === 'ok' ? (
                <APath
                  d={`M${a1} ${a2}L${b1x} ${b1y}L${e1} ${e2}`}
                  animatedProps={checkProps}
                  stroke={c.textOnSolid}
                  strokeWidth={markW}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={[checkLen, checkLen]}
                  fill="none"
                />
              ) : (
                <>
                  <APath d={`M${lo[0]} ${lo[1]}L${hi[0]} ${hi[1]}`} animatedProps={x1Props} stroke={c.textOnSolid} strokeWidth={markW} strokeLinecap="round" strokeDasharray={[xLen, xLen]} fill="none" />
                  <APath d={`M${hi[0]} ${lo[1]}L${lo[0]} ${hi[1]}`} animatedProps={x2Props} stroke={c.textOnSolid} strokeWidth={markW} strokeLinecap="round" strokeDasharray={[xLen, xLen]} fill="none" />
                </>
              )}
            </G>
          </Svg>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
