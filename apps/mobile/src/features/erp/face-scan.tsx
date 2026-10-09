import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { Button, Txt } from '@/design/primitives';
import { Icon, type IconName } from '@/design/icons';
import { StatusMark } from '@/design/success';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { DUR, EASE_LOOP, haptic, useReducedMotion } from '@/design/motion';
import { MAX_FRAME_B64, STEP1_MS, STEP2_MS, TASK_SETTLE_MS, type FaceChallenge, type FaceTask, taskLine } from '@/core/face-liveness';

/**
 * Ilova ichidagi yuz skaneri — davomat uchun ("Keldim / Ketdim" va rahbarning "Keldi — yuz skaneri").
 *
 * Suratga olish ekrani EMAS: tugma, galereya, olingan rasmning ko'rinishi yo'q. Kamera ochiladi, yuz oval
 * ramkaga joylanadi, ~1,2 s dan keyin kadr o'zi (ovozsiz) olinadi va to'g'ridan-to'g'ri tekshiruvga ketadi.
 * Kadr faqat xotirada (base64) — vaqtinchalik fayl darhol o'chiriladi, galereyaga saqlanmaydi.
 *
 * Ishlatish (bir joyda `<FaceScanHost/>` ildiz maketida turadi):
 *   const r = await scanFace({ verify: async (photo) => { await api(photo); return { ok: true }; } });
 * `verify` berilsa skaner server javobini kutib turadi va natijani o'zida ko'rsatadi: "Tanildi" (0,9 s dan
 * keyin yopiladi) yoki "Tanilmadi" + "Qayta urinish" / "Yopish".
 *
 * Jonlilik (yangi ERP): `challenge` berilsa skaner avval ERP'dan bir martalik nonce va topshiriq oladi
 * (`core/face-liveness.ts`), topshiriqni katta matn va ikonka bilan ko'rsatadi va 3 kadr oladi: [0] — to'g'ri qarab,
 * [1] — "Boshingizni chapga buring" (yoki "Ko'zingizni yuming") dan ~0,7 s keyin, [2] — "Kameraga qarang" dan keyin.
 * Kadrlar `verify` ga `frames` qilib beriladi. Topshiriq kelmasa (eski ERP) — eskicha bitta kadr. Har "Qayta urinish"
 * yangi challenge oladi (nonce bir martalik). Yangi native modul yo'q — o'sha expo-camera `takePictureAsync`.
 *
 * Native modul (expo-camera) eski build'da yo'q bo'lishi mumkin (OTA yangi JS'ni eski ilovaga olib keladi) —
 * kech yuklanadi va yo'q bo'lsa "Ilovaning yangi versiyasi kerak" deyiladi.
 */

export type FaceScanResult = { ok: true; photo: string } | { ok: false; message: string };
export type FaceVerifyResult = { ok: true; message?: string } | { ok: false; message: string };
/** Olingan kadr(lar): `photo` — asosiy (birinchi) kadr; `frames` — jonlilik ketma-ketligi (topshiriq bo'lsa); `nonce` — challenge. */
export interface FaceShot { photo: string; frames?: string[]; nonce?: string }
export interface FaceScanOptions {
  /** Yuqoridagi sarlavha. */
  title?: string;
  /** Boshlang'ich kamera: `front` (o'zi) yoki `back` (rahbar xodimni skaner qiladi). */
  facing?: 'front' | 'back';
  /** Old/orqa kamerani almashtirish tugmasi. */
  allowFlip?: boolean;
  /** Kadrni tekshirish (server). Berilmasa kadr olinishi bilan skaner yopiladi. */
  verify?: (shot: FaceShot) => Promise<FaceVerifyResult>;
  /** Har urinish oldidan challenge (nonce + topshiriq) — `erpAuth.faceChallenge`. Berilmasa — topshiriqsiz bitta kadr. */
  challenge?: () => Promise<FaceChallenge>;
}

type CameraModule = typeof import('expo-camera');
type FsModule = typeof import('expo-file-system');
let camCache: CameraModule | null | undefined;
function loadCamera(): CameraModule | null {
  if (camCache !== undefined) return camCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    camCache = require('expo-camera') as CameraModule;
  } catch {
    camCache = null;
  }
  return camCache;
}
/** Kamera kadri keshdagi vaqtinchalik fayl — base64 olingach o'chiriladi (hech qayerda qolmasin). */
function dropFile(uri?: string) {
  if (!uri) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('expo-file-system') as FsModule;
    void fs.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  } catch { /* modul yo'q — kesh baribir tozalanadi */ }
}

type Req = { id: number; opts: FaceScanOptions; resolve: (r: FaceScanResult) => void };
const useScanStore = create<{ req: Req | null }>(() => ({ req: null }));
let seq = 0;
const CANCELLED = 'Skaner yopildi — davomat yozilmadi.';

/** Skanerni ochadi. Natija — kadr (data-URL) yoki sabab. Bir vaqtda bitta skaner: yangisi eskisini yopadi. */
export function scanFace(opts: FaceScanOptions = {}): Promise<FaceScanResult> {
  return new Promise((resolve) => {
    useScanStore.getState().req?.resolve({ ok: false, message: CANCELLED });
    useScanStore.setState({ req: { id: ++seq, opts, resolve } });
  });
}
function finish(id: number, r: FaceScanResult) {
  const req = useScanStore.getState().req;
  if (!req || req.id !== id) return;
  useScanStore.setState({ req: null });
  req.resolve(r);
}

/** Ildiz maketiga bir marta qo'yiladi (Dialog/Result host'lar yonida). Native <Modal> emas — daraxt ichida chiziladi. */
export function FaceScanHost() {
  const req = useScanStore((s) => s.req);
  if (!req) return null;
  return <FaceScanner key={req.id} req={req} />;
}

function FaceScanner({ req }: { req: Req }) {
  const { c } = useTheme();
  const cam = loadCamera();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bgInverse }]}>
      {cam ? (
        <CameraGate cam={cam} req={req} />
      ) : (
        <Notice
          req={req}
          icon="smartphone"
          title="Ilovaning yangi versiyasi kerak"
          text="Yuz skaneri uchun ilovani do'kondan yangilang."
          result="Yuz skaneri uchun ilovaning yangi versiyasi kerak — do'kondan yangilang."
        />
      )}
    </View>
  );
}

/** Kamera ruxsati: so'raladi; rad etilgan bo'lsa — "Sozlamalarni ochish" (qaytib kelganda qayta tekshiriladi). */
function CameraGate({ cam, req }: { cam: CameraModule; req: Req }) {
  const { c } = useTheme();
  const [perm, request, refresh] = cam.useCameraPermissions();
  const asked = useRef(false);
  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain && !asked.current) { asked.current = true; void request(); }
  }, [perm, request]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void refresh(); });
    return () => sub.remove();
  }, [refresh]);
  if (!perm) return <View style={styles.center}><ActivityIndicator color={c.textOnSolid} /></View>;
  if (!perm.granted) {
    return (
      <Notice
        req={req}
        icon="camera"
        title="Kameraga ruxsat kerak"
        text="Davomat uchun yuzingiz kamera orqali skanerlanadi. Rasm galereyaga saqlanmaydi."
        result="Kameraga ruxsat berilmadi — davomat yozilmadi."
        action={perm.canAskAgain
          ? { title: 'Ruxsat berish', onPress: () => void request() }
          : { title: 'Sozlamalarni ochish', onPress: () => void Linking.openSettings() }}
      />
    );
  }
  return <Scanner cam={cam} req={req} />;
}

/** Ruxsat yo'q / modul yo'q — qorong'i fonda izoh, amal tugmasi va "Yopish". */
function Notice({ req, icon, title, text, result, action }: { req: Req; icon: IconName; title: string; text: string; result: string; action?: { title: string; onPress: () => void } }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const close = () => finish(req.id, { ok: false, message: result });
  useBack(close);
  return (
    <View style={[styles.center, { padding: space.pageX, paddingBottom: insets.bottom + space.xl, gap: space.md }]}>
      <Icon name={icon} size={size.iconLg} color={c.textOnSolid} />
      <Txt v="titleMd" color="onSolid" align="center">{title}</Txt>
      <Txt v="bodySm" color="onSolid" align="center">{text}</Txt>
      <View style={{ alignSelf: 'stretch', gap: space.sm, marginTop: space.lg }}>
        {action ? <Button size="lg" title={action.title} onPress={action.onPress} /> : null}
        <Button size="lg" variant="secondary" title="Yopish" onPress={close} />
      </View>
    </View>
  );
}

function useBack(onBack: () => void) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { ref.current(); return true; });
    return () => sub.remove();
  }, []);
}

type Phase = 'align' | 'scan' | 'verify' | 'ok' | 'fail';
/** Kadr hajmi chegarasi (base64 belgilari, ~1,5 MB) — oshsa pastroq sifat bilan qayta olinadi. */
const MAX_B64 = 2_000_000;
/** Kamera tayyor bo'lgach kadr olinguncha (yuzni ramkaga joylash vaqti). */
const SETTLE_MS = 1200;
/** "Tanildi" ko'rinib turadigan vaqt. */
const OK_HOLD_MS = 900;
/** Server tekshiruvi kutiladigan eng uzoq vaqt — keyin "Server javob bermadi" (kech javob e'tiborsiz). */
const VERIFY_TIMEOUT_MS = 20_000;
/** Kadr o'lchami: yuzni solishtirishga ~640 px yetadi; 12 MP kadr base64'da chegaradan oshadi. */
const MIN_SIDE_PX = 640;
const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
class ShotError extends Error {}

/**
 * `getAvailablePictureSizesAsync` ro'yxatidan ("1920x1080", iOS'da yana "Photo"/"Medium" kabi presetlar)
 * katta tomoni ≥ 640 px bo'lgan eng kichik o'lchamni tanlaydi; topilmasa — iOS "Medium" yoki standart (undefined).
 */
function pickPictureSize(sizes: string[]): string | undefined {
  let best: { s: string; area: number } | null = null;
  for (const str of sizes) {
    const m = /(\d+)\s*x\s*(\d+)/i.exec(str);
    if (!m) continue;
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (Math.max(w, h) < MIN_SIDE_PX) continue;
    if (!best || w * h < best.area) best = { s: str, area: w * h };
  }
  if (best) return best.s;
  return sizes.includes('Medium') ? 'Medium' : undefined;
}

const AEllipse = Animated.createAnimatedComponent(Ellipse);

function Scanner({ cam, req }: { cam: CameraModule; req: Req }) {
  const { CameraView } = cam;
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { width: W, height: H } = useWindowDimensions();
  const ref = useRef<InstanceType<CameraModule['CameraView']>>(null);
  const [facing, setFacing] = useState<'front' | 'back'>(req.opts.facing ?? 'front');
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('align');
  const [msg, setMsg] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Jonlilik: joriy urinishning topshirig'i, challenge yuklanmoqdami va kadrlar orasidagi ko'rsatma
  const [task, setTask] = useState<FaceTask | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  // Kamera ochilmasa (onMountError) "Qayta urinish" CameraView'ni qaytadan yaratadi (key orqali)
  const [mount, setMount] = useState(0);
  const mountFailed = useRef(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const sized = useRef(false);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const self = facing === 'front';
  const close = () => {
    if (phase === 'ok') return; // "Tanildi" — o'zi yopilmoqda
    // Tekshiruv paytida ham yopsa bo'ladi: kech kelgan javob e'tiborsiz (finish id bo'yicha, komponent esa yo'q)
    finish(req.id, { ok: false, message: phase === 'fail' && msg ? msg : CANCELLED });
  };
  useBack(close);

  const fail = (m: string) => { setMsg(m); setPhase('fail'); haptic.error(); };

  /**
   * Bitta kadr (data-URL). Hajm chegarasi: topshiriqli ketma-ketlikda har kadr `MAX_FRAME_B64` (3 tasi birga yuboriladi),
   * bitta kadrda `MAX_B64`; oshsa past sifat bilan bir marta qayta olinadi.
   */
  const shoot = async (multi: boolean): Promise<string> => {
    const limit = multi ? MAX_FRAME_B64 : MAX_B64;
    const shot = (quality: number) => ref.current!.takePictureAsync({ quality, base64: true, skipProcessing: false, shutterSound: false, imageType: 'jpg', exif: false });
    let pic = await shot(multi ? 0.4 : 0.5);
    if (pic?.base64 && pic.base64.length > limit) { dropFile(pic.uri); pic = await shot(multi ? 0.25 : 0.3); }
    dropFile(pic?.uri);
    if (!pic?.base64) throw new ShotError("Kadr olinmadi — qayta urining.");
    if (pic.base64.length > limit) throw new ShotError("Kadr hajmi juda katta — qayta urinib ko'ring.");
    return `data:image/jpeg;base64,${pic.base64}`;
  };

  const capture = async (ch: FaceChallenge | null) => {
    if (busy.current || !ref.current) return;
    busy.current = true;
    setPhase('scan');
    setStep(null);
    try {
      const t = ch?.task ?? null;
      const photo = await shoot(!!t);
      let frames: string[] | undefined;
      if (t) {
        // Topshiriq: [1] — ko'rsatmadan ~0,7 s keyin (bosh burilgan / ko'z yumuq), [2] — "Kameraga qarang" dan keyin
        setStep(t.steps[0]);
        haptic.light();
        await sleep(STEP1_MS);
        if (!alive.current || !ref.current) return;
        const f1 = await shoot(true);
        setStep(t.steps[1]);
        await sleep(STEP2_MS);
        if (!alive.current || !ref.current) return;
        const f2 = await shoot(true);
        setStep(null);
        frames = [photo, f1, f2];
      }
      if (!alive.current) return;
      const shotData: FaceShot = { photo, frames, nonce: ch?.nonce };
      if (!req.opts.verify) { haptic.success(); finish(req.id, { ok: true, photo }); return; }
      setPhase('verify');
      let v: FaceVerifyResult;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<FaceVerifyResult>((res) => {
        timer = setTimeout(() => res({ ok: false, message: "Server javob bermadi — qayta urinib ko'ring" }), frames ? VERIFY_TIMEOUT_MS + 10_000 : VERIFY_TIMEOUT_MS);
      });
      try {
        v = await Promise.race([req.opts.verify(shotData), timeout]);
      } catch {
        v = { ok: false, message: "Tekshirib bo'lmadi — internetni tekshirib qayta urining." };
      } finally {
        clearTimeout(timer);
      }
      if (!alive.current) return;
      if (!v.ok) { fail(v.message); return; }
      setMsg(v.message ?? null);
      setPhase('ok');
      haptic.success();
      setTimeout(() => finish(req.id, { ok: true, photo }), OK_HOLD_MS);
    } catch (e) {
      if (alive.current) fail(e instanceof ShotError ? e.message : "Kamera kadr bermadi — qayta urining.");
    } finally {
      busy.current = false;
      if (alive.current) setStep(null);
    }
  };

  // Kamera tayyor → (challenge: nonce + topshiriq) → "Yuzingizni ramkaga joylang" / topshiriq → kadr(lar) (o'zi, tugmasiz)
  useEffect(() => {
    if (!ready) return;
    let off = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    setPhase('align');
    setTask(null);
    setStep(null);
    void (async () => {
      let ch: FaceChallenge | null = null;
      if (req.opts.challenge) {
        setPreparing(true);
        try { ch = await req.opts.challenge(); } catch { ch = {}; }
        if (off) return;
        setPreparing(false);
      }
      const t = ch?.task ?? null;
      setTask(t);
      const settle = t ? TASK_SETTLE_MS : SETTLE_MS;
      // Topshiriqsiz: yarmida "Skanerlanmoqda…"; topshiriqda esa matn kadrgacha ko'rinib turadi
      if (!t) timers.push(setTimeout(() => { if (!busy.current) setPhase('scan'); }, settle / 2));
      timers.push(setTimeout(() => void capture(ch), settle));
    })();
    return () => { off = true; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, attempt, facing]);

  const retry = () => {
    setMsg(null);
    setPhase('align');
    if (mountFailed.current) { mountFailed.current = false; setReady(false); setMount((k) => k + 1); }
    setAttempt((a) => a + 1);
  };
  const flip = () => {
    if (busy.current || phase === 'verify' || phase === 'ok') return;
    setMsg(null);
    setReady(false); // yangi kamera tayyor bo'lgach kadr olinadi (oldingisining "ready"si emas)
    sized.current = false;
    setPictureSize(undefined);
    setFacing((f) => (f === 'front' ? 'back' : 'front'));
  };
  // Kamera tayyor: avval kichik kadr o'lchamini tanlaymiz (bir marta), keyin skanerlash boshlanadi
  const onReady = async () => {
    if (!sized.current && ref.current) {
      sized.current = true;
      try {
        const size = pickPictureSize(await ref.current.getAvailablePictureSizesAsync());
        if (!alive.current) return;
        if (size) setPictureSize(size);
      } catch { /* ro'yxat yo'q — standart o'lcham, hajm baribir tekshiriladi */ }
    }
    if (alive.current) setReady(true);
  };

  // Oval ramka: ekran kengligining ~70%, yuz shaklida cho'zinchoq, yuqoriroqda
  const rx = Math.min(W * 0.35, 150);
  const ry = rx * 1.3;
  const cx = W / 2;
  const cy = Math.max(insets.top + space.x12 + ry + space.xl, H * 0.42);
  const hole = `M0 0H${W}V${H}H0Z M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
  const working = phase === 'scan' || phase === 'verify';
  const ring = phase === 'ok' ? c.successSolid : phase === 'fail' ? c.dangerSolid : working ? c.brand : c.textOnSolid;

  // Yumshoq animatsiya: skanerlash chizig'i va pulslovchi halqa (faqat ishlayotganda; "kamroq harakat"da yo'q)
  const line = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (working && !reduce) {
      line.value = 0;
      line.value = withRepeat(withTiming(1, { duration: 1400, easing: EASE_LOOP }), -1, true);
      pulse.value = 0;
      pulse.value = withRepeat(withTiming(1, { duration: DUR.pulse, easing: EASE_LOOP }), -1, false);
    } else {
      cancelAnimation(line);
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [working, reduce, line, pulse]);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (0.08 + 0.84 * line.value) * 2 * ry }] }));
  const pulseProps = useAnimatedProps(() => ({
    rx: rx * (1 + 0.07 * pulse.value),
    ry: ry * (1 + 0.07 * pulse.value),
    strokeOpacity: working ? 0.7 * (1 - pulse.value) : 0,
  }));

  // Topshiriq paytida sarlavha — katta ko'rsatma ("Boshingizni chapga buring"), ikonka bilan
  const showTask = !!task && (phase === 'align' || phase === 'scan');
  const taskIcon = task && (phase === 'align' || step === task.steps[0]) ? task.icon : null;
  const head = phase === 'align' && preparing ? 'Tayyorlanmoqda…'
    : phase === 'align' && task ? taskLine(task, self)
    : phase === 'scan' && task ? (step ?? 'Kameraga qarang')
    : phase === 'align' ? (self ? 'Yuzingizni ramkaga joylang' : 'Yuzni ramkaga joylang')
    : phase === 'scan' ? 'Skanerlanmoqda…'
    : phase === 'verify' ? 'Tekshirilmoqda…'
    : phase === 'ok' ? 'Tanildi'
    : 'Tanilmadi';
  const sub = phase === 'align' && task ? `${task.hint}. Kadr o'zi olinadi`
    : phase === 'scan' && task ? (step ? null : 'Qimirlamang')
    : phase === 'align' ? (self ? "Telefonni yuz ro'parasida tuting, yorug' joyda" : 'Kamerani xodimning yuziga qarating')
    : phase === 'scan' ? "Qimirlamang"
    : phase === 'verify' ? 'Face ID bilan solishtirilmoqda'
    : msg ?? (phase === 'fail' ? 'Qayta urinib ko\'ring' : '');

  return (
    <View style={StyleSheet.absoluteFill}>
      <CameraView
        key={`${facing}:${mount}`}
        ref={ref}
        style={StyleSheet.absoluteFill}
        facing={facing}
        pictureSize={pictureSize}
        animateShutter={false}
        onCameraReady={() => void onReady()}
        onMountError={() => { mountFailed.current = true; setReady(false); fail("Kamera ochilmadi — qayta urinib ko'ring."); }}
      />
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path d={hole} fill={c.scrim} fillRule="evenodd" />
        <AEllipse cx={cx} cy={cy} stroke={ring} strokeWidth={2} fill="none" animatedProps={pulseProps} />
        <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={ring} strokeWidth={3} fill="none" strokeOpacity={phase === 'align' ? 0.8 : 1} />
      </Svg>
      {working && !reduce ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: cx - rx, top: cy - ry, width: 2 * rx, height: 2 * ry, borderRadius: rx, overflow: 'hidden' }}>
          <Animated.View style={[{ position: 'absolute', left: space.lg, right: space.lg, top: 0, height: 2, borderRadius: radius.pill, backgroundColor: c.brand, opacity: 0.9 }, lineStyle]} />
        </View>
      ) : null}
      {phase === 'ok' || phase === 'fail' ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: cx - rx, top: cy - ry, width: 2 * rx, height: 2 * ry, alignItems: 'center', justifyContent: 'center' }}>
          <StatusMark tone={phase === 'ok' ? 'success' : 'danger'} size={88} icon={phase === 'ok' ? 'check' : 'x'} />
        </View>
      ) : null}

      {/* Yuqori panel: yopish, sarlavha, kamerani almashtirish */}
      <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <RoundBtn icon="x" label="Yopish" onPress={close} disabled={phase === 'ok'} />
        <Txt v="titleMd" color="onSolid" align="center" numberOfLines={1} style={{ flex: 1 }}>{req.opts.title ?? 'Yuz skaneri'}</Txt>
        {req.opts.allowFlip ? <RoundBtn icon="refresh-cw" label="Kamerani almashtirish" onPress={flip} disabled={phase === 'verify' || phase === 'ok'} /> : <View style={{ width: size.touch }} />}
      </View>

      {/* Holat matni va (xatoda) tugmalar */}
      <View style={{ position: 'absolute', left: space.pageX, right: space.pageX, top: cy + ry + space.xxl, bottom: insets.bottom + space.xl, gap: space.sm }}>
        {taskIcon ? (
          <View style={{ alignSelf: 'center', width: size.touch, height: size.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brand }}>
            <Icon name={taskIcon} size={size.iconXl} color={c.textOnSolid} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm }}>
          {phase === 'verify' || (phase === 'align' && preparing) ? <ActivityIndicator color={c.textOnSolid} /> : null}
          <Txt v={showTask ? 'titleLg' : 'titleMd'} color="onSolid" align="center" accessibilityLiveRegion="polite">{head}</Txt>
        </View>
        {sub ? <Txt v="bodySm" color="onSolid" align="center" numberOfLines={4}>{sub}</Txt> : null}
        <View style={{ flex: 1 }} />
        {phase === 'fail' ? (
          <View style={{ gap: space.sm }}>
            <Button size="lg" icon="refresh-cw" title="Qayta urinish" onPress={retry} />
            <Button size="lg" variant="secondary" title="Yopish" onPress={close} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function RoundBtn({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={space.sm}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ width: size.touch, height: size.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: c.scrim, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}
    >
      <Icon name={icon} size={size.iconMd} color={c.textOnSolid} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
