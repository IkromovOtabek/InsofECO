import React, { useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type * as ImagePickerNS from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Callout, Card, EmptyState, IconTile, ListGroup, ListItem, Txt } from '@/design/primitives';
import { ChipGroup, KpiGrid, PageHeader, Reveal, SectionHead, SkeletonList } from '@/design/blocks';
import { dialog, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space, type ModuleTone } from '@/design/tokens';
import { useHeaderRaise } from '@/design/motion';
import { ApiException, deviceId } from '@/core/api';
import { currentFix, ensureForegroundLocation, metersBetween } from '@/core/location';
import { erpAuth, type ErpAttendanceAccess, type ErpHomeData, type ErpMyAttendanceDay, type ErpSelfAttendance, type ErpSelfMarkResult } from '@/core/erp';
import { scanFace } from '@/features/erp/face-scan';
import { facePayload } from '@/core/face-liveness';

/**
 * Xodimning o'z davomati — bosh sahifadagi "Keldim / Ketdim" kartasi va "Mening davomatim" ekrani.
 *
 * Tugma bosilganda:
 *   1) joylashuv ruxsati va yangi GPS nuqta (keshdagi emas); soxta joylashuv, past aniqlik va ish joyidan
 *      uzoqlik shu yerda — kamera ochilmasdan oldin — aytiladi (yakuniy qaror baribir serverda);
 *   2) ilova ichidagi yuz skaneri (`face-scan.tsx`): old kamera, kadr o'zi olinadi (tugma, galereya yo'q);
 *   3) skaner ochiq turganda `POST /api/mobile/attendance/self` — server kadrni ERP'dagi Face ID namunasi bilan
 *      (yo'q bo'lsa profil surati bilan) solishtiradi, geofence/takror/soatni tekshiradi; natija ("Tanildi" / "Tanilmadi") skaner ichida.
 * Bekor qilinsa yoki tanilmasa — hech narsa yozilmaydi, "Qayta urinish" chiqadi.
 *
 * Hududdan tashqarida (`anywhere` — otdel kadr/direktor ruxsati): rad etilmaydi — ogohlantirish, keyin orqa kamera bilan
 * turgan joy surati, keyin odatdagi yuz skaneri. Joy surati yuz skaneridan OLDIN olinadi: `markSelf` skaner ichida
 * (yuz kadri bilan) bitta so'rov bo'lib ketadi, nonce esa skaner ochilganda olinadi — eskirmaydi.
 * Server baribir "joy surati kerak" desa (`PLACE_PHOTO_REQUIRED`, GPS farqi) — surat olinib, skaner qayta ochiladi.
 */

type Stage = 'idle' | 'gps' | 'place' | 'scan';
const STAGE_TEXT: Record<Stage, string> = { idle: '', gps: 'Joylashuv aniqlanmoqda…', place: 'Ish hududidan tashqaridasiz — atrofingiz (joy) rasmini oling', scan: 'Yuz skaneri…' };
/** Serverdagi `MAX_ACCURACY_M` bilan bir xil — bundan yomon nuqta bilan kamerani ochib o'tirmaymiz. */
const MAX_ACCURACY_M = 150;
const NET_ERROR = "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring";
/** Serverning o'zbekcha xabari — faqat `ApiException` da; boshqasi ("Network request failed" va h.k.) — umumiy matn. */
const errText = (e: unknown) => (e instanceof ApiException && e.message ? e.message : NET_ERROR);
const meters = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const PLACE_REQUIRED = 'PLACE_PHOTO_REQUIRED';
const PLACE_HINT = 'Ish hududidan tashqaridasiz — atrofingiz (joy) rasmini oling';

/** Xodimga hududdan tashqarida belgilash ruxsat etilganmi (server ildizda yoki `workplace` ichida beradi; yo'q — false). */
export const canMarkAnywhere = (s: ErpSelfAttendance) => !!(s.anywhere ?? s.workplace?.anywhere);

/**
 * expo-image-picker native moduli eski build'da bo'lmasligi mumkin (OTA yangi JS'ni eski ilovaga olib keladi) —
 * to'g'ridan-to'g'ri import ilovani yiqitadi; `form.tsx` dagi kabi faqat modul bor bo'lsa yuklanadi.
 */
const ImagePicker: typeof ImagePickerNS | null = requireOptionalNativeModule('ExponentImagePicker')
  ? (require('expo-image-picker') as typeof ImagePickerNS)
  : null;

/** Turgan joy surati — faqat orqa kamera (galereya yo'q), sifat 0.5. `null` — xodim kamerani yopdi. */
async function takePlacePhoto(): Promise<{ ok: true; photo: string } | { ok: false; message: string } | null> {
  if (!ImagePicker) return { ok: false, message: "Bu ilova versiyasida kamera yo'q — ilovani yangilang." };
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { ok: false, message: 'Kamera ruxsati berilmagan — telefon Sozlamalaridan ilovaga ruxsat bering.' };
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, base64: true, cameraType: ImagePicker.CameraType.back });
  const a = r.canceled ? null : r.assets[0];
  if (!a) return null;
  if (!a.base64) return { ok: false, message: "Surat olinmadi — qayta urining." };
  return { ok: true, photo: `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` };
}

/** Ogohlantirish oynasi → `true` (davom etish) yoki `false`. */
function confirmOutside(far: number | null): Promise<boolean> {
  return new Promise((resolve) => {
    dialog(
      'Hududdan tashqarida',
      far != null
        ? `Siz ish hududidan ${meters(far)} uzoqdasiz. Davom etish uchun yuzingiz va turgan joyingiz rasmi olinadi.`
        : 'Ish hududi aniqlanmadi. Davom etish uchun yuzingiz va turgan joyingiz rasmi olinadi.',
      [
        { text: 'Bekor qilish', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Davom etish', onPress: () => resolve(true) },
      ],
      { tone: 'warning', icon: 'map-pin', onDismiss: () => resolve(false) },
    );
  });
}

/** "Keldim" / "Ketdim" oqimi. Muvaffaqiyatda bosh sahifa keshi darhol yangilanadi. */
function useSelfMark() {
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  // Ikki marta tez bosish: `stage` yopilma (closure) ichida eskirgan bo'ladi — bayroq ref'da, sinxron qo'yiladi
  const busyRef = useRef(false);

  const run = async (s: ErpSelfAttendance) => {
    if (!s.next || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    try {
      const anywhere = canMarkAnywhere(s);
      if (!s.workplace && !anywhere) { setError("Ish joyi koordinatasi sozlanmagan — administratorga murojaat qiling."); return; }
      // 1) Joylashuv ruxsati va yangi GPS nuqta — kamera ochilishidan oldin (uzoqda bo'lsa skaner ochilmaydi)
      const access = await ensureForegroundLocation();
      if (access === 'services-off') { setError("Telefonda joylashuv (GPS) o'chiq — yoqib qayta urining."); return; }
      if (access !== 'granted') {
        setError(access === 'blocked' ? "Joylashuv ruxsati berilmagan — telefon Sozlamalaridan ilovaga ruxsat bering." : 'Davomat uchun joylashuv ruxsati kerak.');
        return;
      }
      setStage('gps');
      const fix = await currentFix(15_000);
      if (!fix) { setError("GPS javob bermadi. Ochiq joyga chiqib qayta urining."); return; }
      setAccuracy(fix.accuracyM != null ? Math.round(fix.accuracyM) : null);
      if (fix.mocked) { setError("Soxta joylashuv (mock GPS) yoqilgan — o'chirib qayta urining."); return; }
      if (fix.accuracyM != null && fix.accuracyM > MAX_ACCURACY_M) { setError(`GPS aniqligi past (±${Math.round(fix.accuracyM)} m). Ochiq joyga chiqib qayta urining.`); return; }
      const far = s.workplace ? metersBetween(fix, s.workplace) : null;
      const outside = far == null || (!!s.workplace && far > s.workplace.radiusM);
      if (outside && !anywhere && s.workplace && far != null) { setError(`Siz ish joyidan ${meters(far)} uzoqdasiz (ruxsat: ${s.workplace.radiusM} m). Ish joyiga kelib qayta urining.`); return; }
      // 1a) Hududdan tashqarida (ruxsat bor): ogohlantirish → turgan joy surati (orqa kamera) — yuz skaneridan oldin
      let placePhoto: string | undefined;
      const askPlace = async (dist: number | null): Promise<boolean> => {
        if (!(await confirmOutside(dist))) return false;
        setStage('place');
        const p = await takePlacePhoto();
        if (!p) { setError("Joy surati olinmadi — hududdan tashqarida davomat uchun turgan joyingiz surati kerak."); return false; }
        if (!p.ok) { setError(p.message); return false; }
        placePhoto = p.photo;
        return true;
      };
      if (outside && !(await askPlace(far))) return;
      // 2) Yuz skaneri; 3) skaner ochiq turganda server tekshiradi (yuz, geofence, takror, soat)
      const kind = s.next;
      let done: ErpSelfMarkResult | null = null;
      let needPlace = false;
      const scanOnce = () => {
        setStage('scan');
        return scanFace({
          title: kind === 'in' ? 'Keldim — yuz skaneri' : 'Ketdim — yuz skaneri',
          facing: 'front',
          // Bir martalik challenge va jonlilik topshirig'i (skaner kadrdan oldin oladi) — eski ERP'da yo'q: nonce'siz, bitta kadr
          challenge: erpAuth.faceChallenge,
          verify: async (shot) => {
            try {
              done = await erpAuth.markSelf({
                kind, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracyM, ...facePayload(shot),
                deviceId: deviceId(), at: new Date().toISOString(), mocked: fix.mocked,
                ...(placePhoto ? { placePhoto } : {}),
              });
              return { ok: true, message: done.message };
            } catch (e) {
              // Server hisobida hududdan tashqarida (GPS farqi), joy surati yo'q — skaner yopiladi, surat olinib qayta ochiladi
              if (e instanceof ApiException && String(e.code) === PLACE_REQUIRED && !placePhoto && anywhere) {
                needPlace = true;
                return { ok: false, message: e.message || PLACE_HINT, retry: false };
              }
              return { ok: false, message: errText(e) };
            }
          },
        });
      };
      let scan = await scanOnce();
      if (!scan.ok && needPlace) {
        if (!(await askPlace(far))) return;
        scan = await scanOnce();
      }
      const r = done as ErpSelfMarkResult | null;
      if (!scan.ok || !r) { setError(scan.ok ? "Davomat yozilmadi — qayta urining." : scan.message); return; }
      // Bosh sahifa kartasi darhol yangi holatda (server javobidan), keyin to'liq yangilanadi
      qc.setQueriesData<ErpHomeData>({ queryKey: ['erp', 'home'] }, (old) => (old ? { ...old, selfAttendance: r.attendance } : old));
      void qc.invalidateQueries({ queryKey: ['erp', 'home'] });
      void qc.invalidateQueries({ queryKey: ['erp', 'my-att'] });
      if (r.already) toast.info(r.message); else toast.success(r.message, 'Davomat');
    } catch (e) {
      setError(errText(e));
    } finally {
      busyRef.current = false;
      setStage('idle');
    }
  };
  return { run, stage, busy: stage !== 'idle', error, accuracy, clearError: () => setError(null) };
}

const stateTone = (s: ErpSelfAttendance) => (s.state === 'in' ? 'success' : s.state === 'out' ? 'info' : s.state === 'other' ? 'warning' : 'neutral');

/**
 * Davomat ekrani tablari (`face-kiosk.tsx`) va bosh sahifadagi «Davomat» tugmasi. Yangi ERP `attendance` beradi (hamma xodimga);
 * eski ERP'da faqat `faceAttendance` (skanerga ruxsati borlar) — undan olinadi, tugma faqat ularda chiqadi.
 */
export function attendanceAccessOf(data: ErpHomeData | undefined): ErpAttendanceAccess | null {
  if (!data) return null;
  if (data.attendance) return data.attendance;
  const face = data.faceAttendance;
  return face ? { canScan: true, canEnroll: face.canEnroll, canViewTable: true, linked: !!data.selfAttendance } : null;
}

/** O'z davomati kartasi: holat, katta "Keldim"/"Ketdim" tugmasi (GPS + yuz skaneri), "Mening davomatim" havolasi. */
export function SelfAttendanceCard({ s, module }: { s: ErpSelfAttendance; module: ModuleTone }) {
  const router = useRouter();
  const m = useSelfMark();
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconTile icon={s.state === 'none' ? 'scan-line' : s.state === 'out' ? 'log-out' : 'log-in'} module={module} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="overline" color="muted" numberOfLines={1}>Davomat · bugun</Txt>
          <Txt v="titleMd" numberOfLines={1}>{s.label}</Txt>
          {s.hint ? <Txt v="caption" numberOfLines={2}>{s.hint}</Txt> : null}
        </View>
        {s.lateMin ? <Badge label={`+${s.lateMin} daq`} tone="warning" /> : s.state !== 'none' ? <Badge label={s.state === 'in' ? 'Ishda' : s.state === 'out' ? 'Ketdi' : 'Belgi'} tone={stateTone(s)} /> : null}
      </View>
      {s.next ? (
        <Button
          size="lg"
          variant={s.next === 'in' ? 'primary' : 'success'}
          icon={s.next === 'in' ? 'scan-line' : 'log-out'}
          title={s.next === 'in' ? 'Keldim' : 'Ketdim'}
          loading={m.busy}
          onPress={() => void m.run(s)}
        />
      ) : null}
      {/* Tugma yuklanishda yozuvini yashiradi — bosqich matni tugma ostida */}
      {s.next && m.busy && STAGE_TEXT[m.stage] ? <Txt v="caption" align="center">{STAGE_TEXT[m.stage]}</Txt> : null}
      {m.error ? (
        <Callout tone="danger">
          <View style={{ gap: space.sm }}>
            <Txt v="bodySm" color="danger">{m.error}</Txt>
            <Button size="md" variant="secondary" full={false} icon="refresh-cw" title="Qayta urinish" onPress={() => void m.run(s)} />
          </View>
        </Callout>
      ) : null}
      {canMarkAnywhere(s) ? <Badge icon="map-pin" label="Hududdan tashqarida ham belgilash mumkin" tone="info" style={{ alignSelf: 'flex-start' }} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
        <Txt v="caption" numberOfLines={1} style={{ flex: 1 }}>
          {m.accuracy != null ? `GPS aniqligi ±${m.accuracy} m` : s.workplace ? `Ish joyidan ${s.workplace.radiusM} m ichida` : canMarkAnywhere(s) ? 'Ish hududi belgilanmagan' : 'Ish joyi sozlanmagan'}
        </Txt>
        <Button size="md" variant="ghost" full={false} iconRight="chevron-right" title="Mening davomatim" onPress={() => router.push('/erp/davomatim' as never)} />
      </View>
    </Card>
  );
}

/**
 * Bosh sahifa tepasidagi davomat bloki (sarlavha ostida): o'z "Keldim/Ketdim" kartasi, hamma xodimga «Davomat» tugmasi
 * (o'z davomati, umumiy jadval, ruxsat bo'lsa skaner) va rahbarda — "Xodimlar davomati" (boshqalarni belgilash) qatori.
 */
export function AttendanceHomeCard({ data, module }: { data: ErpHomeData; module: ModuleTone }) {
  const router = useRouter();
  const s = data.selfAttendance;
  const manage = data.attendanceManage;
  const access = attendanceAccessOf(data);
  if (!s && !manage && !access) return null;
  const go = (href: string) => router.push(href as never);
  return (
    <View style={{ gap: space.md }}>
      {s ? <SelfAttendanceCard s={s} module={module} /> : null}
      {/* ERP Bosh sahifa → «Davomat» kabi: o'z davomati, umumiy jadval; ruxsat bo'lsa Face ID skaneri va yuzlar */}
      {access ? <Button size="lg" icon={access.canScan ? 'scan-line' : 'clipboard-list'} title="Davomat" onPress={() => go('/erp/face')} /> : null}
      {manage ? (
        <ListGroup>
          <ListItem icon="users" module={module} title={manage.title} subtitle={manage.subtitle} onPress={() => go(`/erp/${manage.key}/${encodeURIComponent(manage.id)}`)} />
        </ListGroup>
      ) : null}
    </View>
  );
}

// ───────────────────────── Mening davomatim ─────────────────────────

const hours = (min: number) => `${(min / 60).toFixed(1).replace('.0', '').replace('.', ',')} soat`;

const dayTone = (d: ErpMyAttendanceDay) =>
  d.status === 'PRESENT' ? (d.lateMin ? 'warning' : 'success') : d.status === 'ABSENT' ? 'danger' : d.status ? 'info' : 'neutral';

/** Kun qatori: "05 · Dush", "08:12 – 18:05 · 12 daq kechikdi", o'ngda soat yoki belgi. */
function DayRow({ d, module }: { d: ErpMyAttendanceDay; module: ModuleTone }) {
  const present = d.status === 'PRESENT';
  const sub = present
    ? `${d.checkIn ?? '—'} – ${d.checkOut ?? '…'}${d.lateMin ? ` · ${d.lateMin} daq kechikdi` : ''}${d.self ? ' · o\'zi' : ''}`
    : d.mark ?? (d.weekend ? 'Dam olish kuni' : 'Belgi yo\'q');
  return (
    <ListItem
      icon={present ? 'log-in' : d.status ? 'calendar-days' : 'circle'}
      module={module}
      tone={d.status === 'ABSENT' ? 'danger' : undefined}
      title={`${String(d.day).padStart(2, '0')} · ${d.weekday}`}
      subtitle={sub}
      value={present && d.minutes != null ? hours(d.minutes) : undefined}
      badge={!present && d.mark ? { text: d.mark, tone: dayTone(d) } : present && d.lateMin ? { text: 'Kechikdi', tone: 'warning' } : undefined}
    />
  );
}

/** "Mening davomatim" — joriy oy (va oldingilari): jami ko'rsatkichlar va kunlar ro'yxati. Faqat o'ziniki. */
export function MyAttendanceScreen({ onBack }: { onBack: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const raise = useHeaderRaise();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const q = useQuery({ queryKey: ['erp', 'my-att', month ?? ''], queryFn: () => erpAuth.myAttendance(month) });
  const d = q.data;
  const mod: ModuleTone = 'brand';
  // Oy tanlovi: joriy va oldingi ikki oy (serverdagi `prev` zanjiri bo'yicha)
  const cur = d?.month;
  const months = cur ? monthChips(cur.month, !month) : [];
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title="Mening davomatim" onBack={onBack} raised={raise.raised} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.brand} />}
      >
        {q.error && !d ? (
          <EmptyState icon="cloud-off" title="Ma'lumot yuklanmadi" hint={(q.error as Error).message} onRetry={() => void q.refetch()} />
        ) : (
          <Reveal loading={q.isLoading || !d} skeleton={<SkeletonList rows={6} />} replay={month}>
            {d ? (
              <Card key="who" style={{ gap: space.xs }}>
                <Txt v="overline" color="muted" numberOfLines={1}>{`${d.month.employee.position} · smena ${d.month.shift.start}–${d.month.shift.end}`}</Txt>
                <Txt v="titleMd" numberOfLines={1}>{d.month.employee.fullName}</Txt>
                <Txt v="bodySm" numberOfLines={2}>{`Bugun: ${d.today.label}${d.today.hint ? ` · ${d.today.hint}` : ''}`}</Txt>
              </Card>
            ) : null}
            {months.length > 1 ? (
              <ChipGroup key="m" items={months} value={cur?.month ?? ''} onChange={(k) => setMonth(k)} />
            ) : null}
            {d ? (
              <KpiGrid
                key="kpi"
                items={[
                  { label: 'Ishga kelgan', value: `${d.month.totals.present} kun`, icon: 'log-in', module: mod },
                  { label: 'Jami ish vaqti', value: hours(d.month.totals.minutes), icon: 'clock', module: mod },
                  { label: 'Kechikish', value: `${d.month.totals.lateDays} kun`, icon: 'alarm-clock', module: mod, tone: d.month.totals.lateDays ? 'warning' : undefined, delta: d.month.totals.lateMinutes ? { text: `jami ${d.month.totals.lateMinutes} daq`, tone: 'warning' } : undefined },
                  { label: 'Kelmagan', value: `${d.month.totals.absent} kun`, icon: 'user-x', module: mod, tone: d.month.totals.absent ? 'danger' : undefined, delta: d.month.totals.sick + d.month.totals.leave ? { text: `kasal/ta'til ${d.month.totals.sick + d.month.totals.leave}`, tone: 'info' } : undefined },
                ]}
              />
            ) : null}
            {d ? <SectionHead key="h" title={d.month.title} count={d.month.days.length || undefined} /> : null}
            {d && d.month.days.length ? (
              <ListGroup key="days">
                {d.month.days.map((x) => <DayRow key={x.date} d={x} module={mod} />)}
              </ListGroup>
            ) : d ? <EmptyState key="e" compact icon="calendar-days" title="Bu oyda davomat yo'q" /> : null}
          </Reveal>
        )}
      </ScrollView>
    </View>
  );
}

const MONTH_SHORT = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const shiftYm = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y!, m! - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Joriy oy va oldingi ikki oy chiplari. `isCurrent` — tanlangan oy joriymi (aks holda chiplar joriy oydan sanaladi). */
function monthChips(selected: string, isCurrent: boolean): { key: string; label: string }[] {
  const now = new Date();
  const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const anchor = isCurrent ? selected : curYm;
  return [0, -1, -2].map((n) => {
    const k = shiftYm(anchor, n);
    return { key: k, label: MONTH_SHORT[Number(k.slice(5, 7)) - 1]! };
  });
}
