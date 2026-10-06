import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Callout, Card, EmptyState, IconTile, ListGroup, ListItem, Txt } from '@/design/primitives';
import { ChipGroup, KpiGrid, PageHeader, Reveal, SectionHead, SkeletonList } from '@/design/blocks';
import { toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space, type ModuleTone } from '@/design/tokens';
import { useHeaderRaise } from '@/design/motion';
import { deviceId } from '@/core/api';
import { currentFix, ensureForegroundLocation, metersBetween } from '@/core/location';
import { erpAuth, type ErpHomeData, type ErpMyAttendanceDay, type ErpSelfAttendance, type ErpSelfMarkResult } from '@/core/erp';
import { scanFace } from '@/features/erp/face-scan';

/**
 * Xodimning o'z davomati — bosh sahifadagi "Keldim / Ketdim" kartasi va "Mening davomatim" ekrani.
 *
 * Tugma bosilganda:
 *   1) joylashuv ruxsati va yangi GPS nuqta (keshdagi emas); soxta joylashuv, past aniqlik va ish joyidan
 *      uzoqlik shu yerda — kamera ochilmasdan oldin — aytiladi (yakuniy qaror baribir serverda);
 *   2) ilova ichidagi yuz skaneri (`face-scan.tsx`): old kamera, kadr o'zi olinadi (tugma, galereya yo'q);
 *   3) skaner ochiq turganda `POST /api/mobile/attendance/self` — server kadrni profil surati bilan
 *      solishtiradi, geofence/takror/soatni tekshiradi; natija ("Tanildi" / "Tanilmadi") skaner ichida.
 * Bekor qilinsa yoki tanilmasa — hech narsa yozilmaydi, "Qayta urinish" chiqadi.
 */

type Stage = 'idle' | 'gps' | 'scan';
const STAGE_TEXT: Record<Stage, string> = { idle: '', gps: 'Joylashuv aniqlanmoqda…', scan: 'Yuz skaneri…' };
/** Serverdagi `MAX_ACCURACY_M` bilan bir xil — bundan yomon nuqta bilan kamerani ochib o'tirmaymiz. */
const MAX_ACCURACY_M = 150;
const meters = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

/** "Keldim" / "Ketdim" oqimi. Muvaffaqiyatda bosh sahifa keshi darhol yangilanadi. */
function useSelfMark() {
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const run = async (s: ErpSelfAttendance) => {
    if (!s.next || stage !== 'idle') return;
    setError(null);
    if (!s.workplace) { setError("Ish joyi koordinatasi sozlanmagan — administratorga murojaat qiling."); return; }
    try {
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
      const far = metersBetween(fix, s.workplace);
      if (far > s.workplace.radiusM) { setError(`Siz ish joyidan ${meters(far)} uzoqdasiz (ruxsat: ${s.workplace.radiusM} m). Ish joyiga kelib qayta urining.`); return; }
      // 2) Yuz skaneri; 3) skaner ochiq turganda server tekshiradi (yuz, geofence, takror, soat)
      setStage('scan');
      const kind = s.next;
      let done: ErpSelfMarkResult | null = null;
      const scan = await scanFace({
        title: kind === 'in' ? 'Keldim — yuz skaneri' : 'Ketdim — yuz skaneri',
        facing: 'front',
        verify: async (photo) => {
          try {
            done = await erpAuth.markSelf({
              kind, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracyM, photo,
              deviceId: deviceId(), at: new Date().toISOString(), mocked: fix.mocked,
            });
            return { ok: true, message: done.message };
          } catch (e) {
            return { ok: false, message: (e as Error).message || "Yuborib bo'lmadi — internetni tekshirib qayta urining." };
          }
        },
      });
      const r = done as ErpSelfMarkResult | null;
      if (!scan.ok || !r) { setError(scan.ok ? "Davomat yozilmadi — qayta urining." : scan.message); return; }
      // Bosh sahifa kartasi darhol yangi holatda (server javobidan), keyin to'liq yangilanadi
      qc.setQueriesData<ErpHomeData>({ queryKey: ['erp', 'home'] }, (old) => (old ? { ...old, selfAttendance: r.attendance } : old));
      void qc.invalidateQueries({ queryKey: ['erp', 'home'] });
      void qc.invalidateQueries({ queryKey: ['erp', 'my-att'] });
      if (r.already) toast.info(r.message); else toast.success(r.message, 'Davomat');
    } catch (e) {
      setError((e as Error).message || "Yuborib bo'lmadi — internetni tekshirib qayta urining.");
    } finally {
      setStage('idle');
    }
  };
  return { run, stage, busy: stage !== 'idle', error, accuracy, clearError: () => setError(null) };
}

const stateTone = (s: ErpSelfAttendance) => (s.state === 'in' ? 'success' : s.state === 'out' ? 'info' : s.state === 'other' ? 'warning' : 'neutral');

/**
 * Bosh sahifa tepasidagi davomat kartasi (sarlavha ostida): holat, katta "Keldim"/"Ketdim" tugmasi,
 * "Mening davomatim" havolasi; rahbarda — "Xodimlar davomati" (boshqalarni belgilash) qatori.
 */
export function AttendanceHomeCard({ data, module }: { data: ErpHomeData; module: ModuleTone }) {
  const router = useRouter();
  const s = data.selfAttendance;
  const manage = data.attendanceManage;
  const m = useSelfMark();
  if (!s && !manage) return null;
  const go = (href: string) => router.push(href as never);
  return (
    <View style={{ gap: space.md }}>
      {s ? (
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
              title={m.busy ? STAGE_TEXT[m.stage] : s.next === 'in' ? 'Keldim' : 'Ketdim'}
              loading={m.busy}
              onPress={() => void m.run(s)}
            />
          ) : null}
          {m.error ? (
            <Callout tone="danger">
              <View style={{ gap: space.sm }}>
                <Txt v="bodySm" color="danger">{m.error}</Txt>
                <Button size="md" variant="secondary" full={false} icon="refresh-cw" title="Qayta urinish" onPress={() => void m.run(s)} />
              </View>
            </Callout>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
            <Txt v="caption" numberOfLines={1} style={{ flex: 1 }}>
              {m.accuracy != null ? `GPS aniqligi ±${m.accuracy} m` : s.workplace ? `Ish joyidan ${s.workplace.radiusM} m ichida` : 'Ish joyi sozlanmagan'}
            </Txt>
            <Button size="md" variant="ghost" full={false} iconRight="chevron-right" title="Mening davomatim" onPress={() => go('/erp/davomatim')} />
          </View>
        </Card>
      ) : null}
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
