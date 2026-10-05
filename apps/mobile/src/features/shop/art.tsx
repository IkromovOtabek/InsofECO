import React from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, Pattern, Polygon, Rect } from 'react-native-svg';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { Txt } from '@/design/primitives';
import { photoUrl, type ShopItem } from './api';

/**
 * Mahsulot illyustratsiyalari — demo `prodArt()` (izometrik beton uyumi, gazoblok, plita, halqa, bordyur).
 * Faqat bezak: server surati bo'lsa surat ko'rinadi, bo'lmasa mahsulot turiga mos chizma.
 * Ranglar mavzudan (yorug'/qorong'i), hex yo'q.
 */
export type ArtKind = 'beton' | 'gazo' | 'plita' | 'halqa' | 'bordyur';

/** Nom / guruh / kod bo'yicha chizma turi (taxminiy — faqat rasm uchun). */
export function artKind(it: { name?: string | null; group?: string | null; code?: string | null; unit?: string | null }): ArtKind {
  const s = `${it.group ?? ''} ${it.name ?? ''} ${it.code ?? ''}`.toLowerCase();
  if (/gazo|blok|block/.test(s)) return 'gazo';
  if (/halqa|quduq|kolodes|\bks\b/.test(s)) return 'halqa';
  if (/bordyur|bordur|\bbr\b/.test(s)) return 'bordyur';
  if (/plita|\bpk\b|panel|lotok/.test(s)) return 'plita';
  return 'beton';
}

const isoP = (ox: number, oy: number, x: number, y: number, z: number) => `${(ox + (x - y) * 0.866).toFixed(1)},${(oy + (x + y) * 0.5 - z).toFixed(1)}`;
const isoXY = (ox: number, oy: number, x: number, y: number, z: number) => ({ x: ox + (x - y) * 0.866, y: oy + (x + y) * 0.5 - z });

/** Izometrik quti: [ust, chap, o'ng] ranglari. */
export function IsoBox({ ox, oy, w, d, h, fill }: { ox: number; oy: number; w: number; d: number; h: number; fill: [string, string, string] }) {
  const P = (x: number, y: number, z: number) => isoP(ox, oy, x, y, z);
  return (
    <>
      <Polygon points={`${P(0, d, 0)} ${P(w, d, 0)} ${P(w, d, h)} ${P(0, d, h)}`} fill={fill[1]} />
      <Polygon points={`${P(w, 0, 0)} ${P(w, d, 0)} ${P(w, d, h)} ${P(w, 0, h)}`} fill={fill[2]} />
      <Polygon points={`${P(0, 0, h)} ${P(w, 0, h)} ${P(w, d, h)} ${P(0, d, h)}`} fill={fill[0]} />
    </>
  );
}

/** Chizma (SVG 180×110) — konteynerni to'ldiradi. */
export function ProdArt({ kind, style, cover }: { kind: ArtKind; style?: StyleProp<ViewStyle>; /** Konteynerni to'liq to'ldiradi (chetlari kesiladi) — kvadrat/dumaloq plitkalar uchun. */ cover?: boolean }) {
  const { c } = useTheme();
  const conc: [string, string, string] = [c.bgSubtle, c.borderDefault, c.borderStrong];
  const white: [string, string, string] = [c.bgSurface, c.bgMuted, c.borderDefault];
  const dot = c.textFaint;
  let body: React.ReactNode;
  if (kind === 'gazo') {
    body = (
      <>
        <IsoBox ox={60} oy={40} w={46} d={22} h={18} fill={white} />
        <IsoBox ox={60} oy={22} w={46} d={22} h={18} fill={white} />
        <IsoBox ox={100} oy={62} w={46} d={22} h={18} fill={white} />
        <IsoBox ox={100} oy={44} w={46} d={22} h={18} fill={white} />
      </>
    );
  } else if (kind === 'plita') {
    body = (
      <>
        <IsoBox ox={36} oy={30} w={96} d={34} h={12} fill={conc} />
        {[0, 1, 2, 3, 4].map((i) => { const p = isoXY(36, 30, 96, 6 + i * 6, 6); return <Ellipse key={i} cx={p.x} cy={p.y} rx={2.6} ry={2.2} fill={dot} />; })}
      </>
    );
  } else if (kind === 'halqa') {
    body = (
      <>
        <Ellipse cx={90} cy={78} rx={46} ry={16} fill={conc[2]} />
        <Rect x={44} y={44} width={92} height={34} fill={conc[1]} />
        <Ellipse cx={90} cy={44} rx={46} ry={16} fill={conc[0]} />
        <Ellipse cx={90} cy={44} rx={36} ry={11} fill={dot} />
      </>
    );
  } else if (kind === 'bordyur') {
    body = (
      <>
        <IsoBox ox={40} oy={40} w={90} d={12} h={24} fill={conc} />
        <IsoBox ox={40} oy={40} w={90} d={4} h={30} fill={conc} />
      </>
    );
  } else {
    body = (
      <>
        <Ellipse cx={90} cy={92} rx={56} ry={14} fill={conc[2]} />
        <Path d="M34 92 Q60 40 90 34 Q120 40 146 92 Z" fill={conc[1]} />
        <Path d="M58 70 Q76 50 92 48" stroke={conc[0]} strokeWidth={6} fill="none" strokeLinecap="round" />
        <Circle cx={72} cy={80} r={2} fill={dot} />
        <Circle cx={108} cy={74} r={2} fill={dot} />
        <Circle cx={96} cy={86} r={1.6} fill={dot} />
      </>
    );
  }
  return (
    <View style={[{ width: '100%', height: '100%' }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 180 110" preserveAspectRatio={cover ? 'xMidYMid slice' : 'xMidYMid meet'}>{body}</Svg>
    </View>
  );
}

/**
 * Mahsulot rasmi: server surati yoki chizma. Surat DOIM `cover` — konteynerni 100% egallaydi, ortiqchasi
 * ota konteynerning `overflow: 'hidden'` + radiusi bilan kesiladi (kvadrat surat dumaloq plitka ichida
 * "orolcha" bo'lib qolmaydi). `cover` — chizma (surat yo'q bo'lsa) ham butun maydonni to'ldiradi.
 */
/**
 * ERP'dagi namuna rasmlar (`/photo/demo-*.png`) — 800×600 tayyor plakat (ichida "M100 · Beton B7,5" yozuvi).
 * Kichik dumaloq/kvadrat plitkaga `cover` bilan kesilganda yozuv qirqilib, xira ko'rinadi — ular o'rniga
 * aniq vektor chizma + marka yoziladi. Haqiqiy yuklangan surat odatdagidek ko'rsatiladi.
 */
const isDemoPhoto = (p: string | null | undefined) => !!p && /\/demo-[^/]*$/i.test(p);

/** Marka yorlig'i: kod (M100) yoki nomdagi "M300"/"D500"/"B25" — bo'lmasa yo'q. */
const gradeOf = (it: { code?: string | null; name?: string | null }) =>
  (it.code && it.code.length <= 8 ? it.code : null) ?? it.name?.match(/\b[MDB]\d{2,3}(?:[.,]\d)?\b/i)?.[0]?.toUpperCase() ?? null;

export function ProductImage({ item, style, cover }: { item: Pick<ShopItem, 'photo' | 'name' | 'group' | 'code' | 'unit'>; style?: StyleProp<ViewStyle>; /** Chizma ham to'liq to'ldirsin (chetlari kesiladi). */ cover?: boolean }) {
  const { c } = useTheme();
  const demo = isDemoPhoto(item.photo);
  const uri = demo ? null : photoUrl(item.photo);
  const [failed, setFailed] = React.useState(false);
  const [w, setW] = React.useState(0);
  React.useEffect(() => setFailed(false), [uri]);
  // Surat yuklanmasa (404, internet yo'q) — bo'sh kulrang joy emas, mahsulot chizmasi
  if (uri && !failed) return <Image source={{ uri }} style={[{ width: '100%', height: '100%' }, style as object]} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />;
  const grade = gradeOf(item);
  return (
    <View style={[{ width: '100%', height: '100%' }, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {/* Kichik plitkada (toifa) to'ldiradi, katta kartada chizma to'liq ko'rinadi — tepasi kesilmaydi */}
      <ProdArt kind={artKind(item)} cover={cover && w > 0 && w < 110} style={{ width: '100%', height: '100%' }} />
      {/* Marka faqat yetarli joyda (karta, mahsulot sahifasi) — 72 dp toifa plitkasida chizmaning o'zi */}
      {grade && w >= 110 ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: space.sm, bottom: space.sm, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: c.bgInverse }}>
          <Txt v={w >= 260 ? 'titleSm' : 'badge'} style={{ color: c.textOnInverse }}>{grade}</Txt>
        </View>
      ) : null}
    </View>
  );
}

/** To'q (bgInverse) karta ustidagi xira katak — demo Chizma hero foni (14 css → 19 dp). */
export function InverseGrid() {
  const { c, paletteName } = useTheme();
  const id = `sg${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (paletteName !== 'chizma') return null;
  const cell = size.tile / 2 - 1;
  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} width="100%" height="100%">
      <Defs>
        <Pattern id={id} x={0} y={0} width={cell} height={cell} patternUnits="userSpaceOnUse">
          <Path d={`M0,0.5 H${cell} M0.5,0 V${cell}`} stroke={c.textOnInverse} strokeOpacity={0.08} strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
