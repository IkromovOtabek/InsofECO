import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useTheme } from '@/design/theme';
import { DUR, EASE_MICRO, EASE_STATE } from '@/design/motion';

/**
 * Yuz skanerining Face ID uslubidagi ko'rinishi: dumaloq "teshik" (atrofi qoraytirilgan), uning atrofida 72 ta qisqa
 * radial chiziqcha (tick). Kadrlar olinishi bilan chiziqchalar soat yo'nalishida yonadi, server tekshiruvida halqa
 * bo'ylab "kometa" aylanadi, muvaffaqiyatda yashil bo'lib biroz qisqaradi va katta belgi chiziladi, xatoda qizil
 * bo'lib chayqaladi.
 *
 * Unumdorlik (arzon Android uchun): 72 ta alohida <Line> + har biriga animatedProps EMAS (har kadrda 72 ta native
 * yangilanish bo'lardi). Buning o'rniga:
 *  - xira halqa — bitta statik <Path> (barcha chiziqchalar bitta `d` da), hech qachon qayta chizilmaydi;
 *  - yonayotgan qism — bitta animatsion <Path>: `d` UI oqimida (worklet) oldindan hisoblangan koordinatalardan
 *    yig'iladi (≤72 ta "M…L…" bo'lagi) — kadrda bitta native prop, JS/React qayta render yo'q;
 *  - kometa — ikkita kichik animatsion <Path> (dum va bosh), indeks butun songa yaxlitlanadi — chiziqchalar har doim
 *    xira halqa chiziqchalari ustiga aniq tushadi;
 *  - qisqarish va chayqalish — View transform (scale/translateX), SVG qayta rasterlanmaydi;
 *  - belgi chizilishi — bitta `strokeDashoffset`.
 * `strokeDasharray` li aylana bilan "soxta chiziqcha" ham arzon, lekin yonish ulushini (progress) cheklash uchun mask
 * kerak bo'lardi — Android'da mask har kadr bitmapga chiziladi va animatsion mask yangilanishi ishonchsiz.
 */

const N = 72;
/** Chap/o'ng tomon ishorasi uchun chiziqchalar soni (≈ 95°). */
const SIDE_TICKS = 19;
/** Chayqalish uchun skrim ekran chetidan shuncha kengroq chiziladi (chet ochilib qolmasin). */
const PAD = 24;

export type RingMode = 'align' | 'scan' | 'verify' | 'ok' | 'fail';

/** Chiziqchalar halqasining tashqi radiusi — maket hisoblash uchun (teshik radiusidan). */
export function ringOuter(r: number): number {
  return r + tickGap(r) + tickLen(r);
}
const tickGap = (r: number) => Math.max(8, Math.round(r * 0.07));
const tickLen = (r: number) => Math.max(10, Math.round(r * 0.1));

/** `from` dan boshlab `count` ta chiziqcha (soat yo'nalishida, aylana bo'ylab) — bitta SVG yo'li. JS va UI oqimida ishlaydi. */
function ticksPath(pts: number[], from: number, count: number): string {
  'worklet';
  if (count <= 0) return 'M-20 -20'; // bo'sh (ko'rinmas) yo'l
  let d = '';
  const start = ((from % N) + N) % N;
  for (let k = 0; k < count && k < N; k++) {
    const i = ((start + k) % N) * 4;
    d += `M${pts[i]} ${pts[i + 1]}L${pts[i + 2]} ${pts[i + 3]}`;
  }
  return d;
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
  const { c } = useTheme();
  const rIn = r + tickGap(r);
  const rOut = ringOuter(r);
  const S = Math.ceil(2 * rOut + 8);
  const o = S / 2;
  const sw = Math.max(2, Math.round(r * 0.022));

  // Chiziqcha uchlari: [x1, y1, x2, y2] × N; 0-chiziqcha tepada, soat yo'nalishida
  const pts = useMemo(() => {
    const a: number[] = [];
    for (let i = 0; i < N; i++) {
      const t = -Math.PI / 2 + (2 * Math.PI * i) / N;
      const cs = Math.cos(t);
      const sn = Math.sin(t);
      a.push(+(o + rIn * cs).toFixed(1), +(o + rIn * sn).toFixed(1), +(o + rOut * cs).toFixed(1), +(o + rOut * sn).toFixed(1));
    }
    return a;
  }, [o, rIn, rOut]);
  const all = useMemo(() => ticksPath(pts, 0, N), [pts]);
  const sidePath = useMemo(
    () => (side ? ticksPath(pts, (side === 'left' ? (3 * N) / 4 : N / 4) - (SIDE_TICKS - 1) / 2, SIDE_TICKS) : null),
    [pts, side],
  );

  const prog = useSharedValue(0);
  const spin = useSharedValue(0);
  const shake = useSharedValue(0);
  const scale = useSharedValue(1);
  const disc = useSharedValue(0);
  const draw = useSharedValue(0);
  const sideOp = useSharedValue(0);

  // Yonish ulushi: kadrlar oqimiga bog'langan (ota komponent bosqichga qarab target/ms beradi)
  useEffect(() => {
    prog.value = reduce || ms <= 0 ? target : withTiming(target, { duration: ms, easing: EASE_MICRO });
  }, [target, ms, reduce, prog]);

  // Server tekshiruvi — halqa bo'ylab aylanuvchi kometa ("kamroq harakat"da yo'q)
  const spinning = mode === 'verify' && !reduce;
  useEffect(() => {
    if (spinning) {
      spin.value = 0;
      spin.value = withRepeat(withTiming(1, { duration: DUR.loop, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(spin);
    }
  }, [spinning, spin]);

  // Natija: muvaffaqiyat — qisqarish + belgi chizilishi; xato — chayqalish + belgi
  useEffect(() => {
    if (mode === 'ok') {
      scale.value = reduce ? 0.93 : withTiming(0.93, { duration: DUR.screen, easing: EASE_STATE });
      disc.value = reduce ? 1 : withTiming(1, { duration: DUR.state, easing: EASE_STATE });
      draw.value = reduce ? 1 : withDelay(DUR.micro, withTiming(1, { duration: 420, easing: EASE_STATE }));
    } else if (mode === 'fail') {
      scale.value = 1;
      disc.value = reduce ? 1 : withTiming(1, { duration: DUR.state, easing: EASE_STATE });
      draw.value = reduce ? 1 : withDelay(DUR.micro, withTiming(1, { duration: DUR.screen, easing: EASE_STATE }));
      if (!reduce) {
        shake.value = withSequence(
          withTiming(-12, { duration: 45 }),
          withRepeat(withTiming(12, { duration: 80 }), 4, true),
          withTiming(0, { duration: 45 }),
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

  const litProps = useAnimatedProps(() => ({ d: ticksPath(pts, 0, Math.round(prog.value * N)) }));
  const tailProps = useAnimatedProps(() => ({ d: ticksPath(pts, Math.floor(spin.value * N) - 14, 10) }));
  const headProps = useAnimatedProps(() => ({ d: ticksPath(pts, Math.floor(spin.value * N) - 4, 5) }));
  const sideProps = useAnimatedProps(() => ({ strokeOpacity: sideOp.value }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const discStyle = useAnimatedStyle(() => ({ opacity: disc.value, transform: [{ scale: 0.6 + 0.4 * disc.value }] }));

  // Belgi (galochka yoki xoch) — teshik markazidagi doira ichida
  const rd = Math.round(r * 0.42);
  const D = 2 * rd;
  const markW = Math.max(4, Math.round(rd * 0.13));
  const P = (x: number, y: number) => [rd + x * rd, rd + y * rd] as const;
  const [a1, a2] = P(-0.42, 0.02);
  const [b1, b2] = P(-0.12, 0.32);
  const [e1, e2] = P(0.44, -0.3);
  const checkLen = Math.ceil(Math.hypot(b1 - a1, b2 - a2) + Math.hypot(e1 - b1, e2 - b2)) + 2;
  const xLen = Math.ceil(0.6 * Math.SQRT2 * rd) + 2;
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: checkLen * (1 - draw.value) }));
  const x1Props = useAnimatedProps(() => ({ strokeDashoffset: xLen * (1 - Math.min(1, draw.value * 2)) }));
  const x2Props = useAnimatedProps(() => ({ strokeDashoffset: xLen * (1 - Math.max(0, draw.value * 2 - 1)) }));
  const lo = P(-0.3, -0.3);
  const hi = P(0.3, 0.3);

  const lit = mode === 'ok' ? c.successSolid : mode === 'fail' ? c.dangerSolid : mode === 'verify' ? c.brand : c.textOnSolid;
  const done = mode === 'ok' || mode === 'fail';
  const hole = `M0 0H${W + 2 * PAD}V${H}H0Z M${cx + PAD - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, shakeStyle]}>
      <Svg width={W + 2 * PAD} height={H} style={{ position: 'absolute', top: 0, left: -PAD }}>
        <Path d={hole} fill={c.scrim} fillRule="evenodd" />
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: cx - o, top: cy - o, width: S, height: S }, scaleStyle]}>
        <Svg width={S} height={S}>
          <Path d={all} stroke={c.textOnSolid} strokeOpacity={0.28} strokeWidth={sw} strokeLinecap="round" fill="none" />
          <APath animatedProps={litProps} stroke={lit} strokeWidth={sw} strokeLinecap="round" fill="none" />
          {spinning ? (
            <>
              <APath animatedProps={tailProps} stroke={c.textOnSolid} strokeOpacity={0.55} strokeWidth={sw} strokeLinecap="round" fill="none" />
              <APath animatedProps={headProps} stroke={c.textOnSolid} strokeWidth={sw} strokeLinecap="round" fill="none" />
            </>
          ) : null}
          {sidePath ? (
            <APath d={sidePath} animatedProps={sideProps} stroke={c.accent} strokeWidth={sw + 1} strokeLinecap="round" fill="none" />
          ) : null}
        </Svg>
      </Animated.View>
      {done ? (
        <Animated.View style={[{ position: 'absolute', left: cx - rd, top: cy - rd, width: D, height: D }, discStyle]}>
          <Svg width={D} height={D}>
            <Circle cx={rd} cy={rd} r={rd} fill={mode === 'ok' ? c.successSolid : c.dangerSolid} fillOpacity={0.9} />
            {mode === 'ok' ? (
              <APath
                d={`M${a1} ${a2}L${b1} ${b2}L${e1} ${e2}`}
                animatedProps={checkProps}
                stroke={c.textOnSolid}
                strokeWidth={markW}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={[checkLen, checkLen]}
                fill="none"
              />
            ) : (
              <G>
                <APath d={`M${lo[0]} ${lo[1]}L${hi[0]} ${hi[1]}`} animatedProps={x1Props} stroke={c.textOnSolid} strokeWidth={markW} strokeLinecap="round" strokeDasharray={[xLen, xLen]} fill="none" />
                <APath d={`M${hi[0]} ${lo[1]}L${lo[0]} ${hi[1]}`} animatedProps={x2Props} stroke={c.textOnSolid} strokeWidth={markW} strokeLinecap="round" strokeDasharray={[xLen, xLen]} fill="none" />
              </G>
            )}
          </Svg>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
