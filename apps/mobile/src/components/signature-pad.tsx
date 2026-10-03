import React, { useImperativeHandle, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, PanResponder, Pressable, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { haptic } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { DEMO_SCALE, elevation, radius, size, space } from '@/design/tokens';

/**
 * Imzo maydoni — demo `.sign` (docs/redesign/shots/27): yuza karta, 70 css chizish maydoni, ostida uzuq chiziq,
 * "Shu yerga imzo qo'ying" va "Tozalash". Barmoq izi react-native-svg `Path` ga yoziladi (PanResponder).
 * `toPng()` — imzoni PNG (base64, prefikssiz) qilib beradi: karta foni + chiziqlar, serverga yuklash uchun.
 */

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  clear: () => void;
  /** PNG base64 (data: prefiksisiz). */ toPng: () => Promise<string>;
  /** SVG path'lar (zaxira / tekshiruv uchun). */ paths: () => string[];
}

const PAD_H = Math.round(70 * DEMO_SCALE);
const STROKE = Math.round(2.4 * DEMO_SCALE * 10) / 10;

type SvgRef = { toDataURL: (cb: (base64: string) => void, opts?: object) => void };

export const SignaturePad = React.forwardRef<SignaturePadHandle, {
  /** Chizish boshlanganda / tugaganda — ota ScrollView'ni to'xtatib turish uchun. */
  onDrawingChange?: (drawing: boolean) => void;
  /** Imzo bor-yo'qligi o'zgarganda. */
  onChange?: (empty: boolean) => void;
}>(function SignaturePad({ onDrawingChange, onChange }, ref) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const [strokes, setStrokes] = useState<string[]>([]);
  const cur = useRef<string | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const svg = useRef<SvgRef | null>(null);
  const cb = useRef({ onDrawingChange, onChange });
  cb.current = { onDrawingChange, onChange };

  const pt = (e: GestureResponderEvent) => `${e.nativeEvent.locationX.toFixed(1)},${e.nativeEvent.locationY.toFixed(1)}`;

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (e) => {
      cb.current.onDrawingChange?.(true);
      const p = pt(e);
      // Bitta nuqta ham ko'rinsin — boshlanishda nolinchi kesma
      cur.current = `M${p} L${p}`;
      setLive(cur.current);
    },
    onPanResponderMove: (e) => {
      if (!cur.current) return;
      cur.current += ` L${pt(e)}`;
      setLive(cur.current);
    },
    onPanResponderRelease: () => finish(),
    onPanResponderTerminate: () => finish(),
  }), []);

  function finish() {
    const d = cur.current;
    cur.current = null;
    setLive(null);
    cb.current.onDrawingChange?.(false);
    if (!d) return;
    setStrokes((s) => {
      if (!s.length) cb.current.onChange?.(false);
      return [...s, d];
    });
  }

  const clear = () => {
    if (!strokes.length) return;
    haptic.light();
    setStrokes([]);
    onChange?.(true);
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => strokes.length === 0,
    clear: () => { setStrokes([]); onChange?.(true); },
    paths: () => strokes,
    toPng: () => new Promise<string>((resolve, reject) => {
      const s = svg.current;
      if (!s) { reject(new Error('Imzo maydoni tayyor emas')); return; }
      try { s.toDataURL((b64) => resolve(b64), { width: w * 2, height: PAD_H * 2 }); } catch (e) { reject(e as Error); }
    }),
  }), [strokes, w, onChange]);

  const empty = strokes.length === 0 && !live;

  return (
    <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', paddingVertical: space.md, paddingHorizontal: space.md + 2, gap: space.xs }, elevation(c).sh1]}>
      <View
        {...pan.panHandlers}
        onLayout={(e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))}
        accessible accessibilityLabel={empty ? "Imzo maydoni — barmoq bilan imzo qo'ying" : 'Imzo qo\'yildi'}
        style={{ height: PAD_H }}
      >
        {w > 0 ? (
          <Svg ref={(r) => { svg.current = r as unknown as SvgRef | null; }} width={w} height={PAD_H}>
            <Rect x={0} y={0} width={w} height={PAD_H} fill={c.bgSurface} />
            {strokes.map((d, i) => <Path key={i} d={d} stroke={c.textStrong} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
            {live ? <Path d={live} stroke={c.textStrong} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
            <Line x1={0} y1={PAD_H - 1} x2={w} y2={PAD_H - 1} stroke={c.borderDefault} strokeWidth={size.hairline} strokeDasharray={[4, 4]} />
          </Svg>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flex: 1 }}>
          <Icon name="pencil" size={size.iconSm} tone="muted" />
          <Txt v="caption" color="muted" numberOfLines={1}>Shu yerga imzo qo&apos;ying</Txt>
        </View>
        <Pressable onPress={clear} disabled={!strokes.length} accessibilityRole="button" accessibilityLabel="Imzoni tozalash" accessibilityState={{ disabled: !strokes.length }} hitSlop={space.md} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Txt v="bodyStrong" color={strokes.length ? 'brand' : 'faint'}>Tozalash</Txt>
        </Pressable>
      </View>
    </View>
  );
});
