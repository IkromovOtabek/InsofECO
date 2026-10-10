import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, EmptyState, IconButton, IconTile, ListGroup, ListItem, SearchField, Txt } from '@/design/primitives';
import { Avatar, dialog, toast } from '@/design/ui';
import { ChipGroup, KpiGrid, PageHeader, Reveal, SectionHead, SegmentedControl, SkeletonList, Toggle } from '@/design/blocks';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useHeaderRaise } from '@/design/motion';
import { ApiException } from '@/core/api';
import { erpAuth, type ErpFaceData, type ErpFaceMode, type ErpFacePhotoRef, type ErpFaceRosterRow, type ErpFaceScanResult } from '@/core/erp';
import { facePayload } from '@/core/face-liveness';
import { usePollInterval } from '@/shared/hooks';
import { scanFace } from './face-scan';
import { StaffAttendanceScreen } from './staff-attendance';
import { errorText } from './pay-api';

/**
 * Davomat — ERP'dagi Bosh sahifa → «Davomat» bilan bir xil (bosh sahifadagi tugmadan ochiladi):
 *   · Skaner — kiosk: telefon xodimlar o'tadigan joyga qo'yiladi, har kim kameraga qaraydi, server uni hamma xodimlar
 *     orasidan taniydi va keldi/ketdi yozadi (`POST /api/mobile/face/scan`). Pastda — bugungi jurnal kadrlari bilan;
 *   · Jadval — barcha xodimlarning kunlik davomati (`StaffAttendanceScreen`);
 *   · Yuzlar — xodim yuzini ro'yxatga olish / o'chirish (faqat otdel kadr darajasi, `canEnroll`).
 * Har bir kadr bosilsa — to'liq ekranda ochiladi. Ruxsat va barcha tekshiruvlar serverda (`lib/mobile/face-kiosk.ts`).
 */

type Tab = 'skaner' | 'jadval' | 'yuzlar';
type Viewer = { ref: ErpFacePhotoRef; title: string; sub?: string };

const MODES: { key: ErpFaceMode; label: string }[] = [
  { key: 'auto', label: 'Avto' },
  { key: 'in', label: 'Keldi' },
  { key: 'out', label: 'Ketdi' },
];
/** "Tanildi" ekrani kioskda shuncha turadi — xodim ismini va vaqtni o'qib ulgursin. */
const KIOSK_HOLD_MS = 2200;
const NET_ERROR = "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring";
const errText = (e: unknown) => (e instanceof ApiException && e.message ? e.message : NET_ERROR);
const refKey = (r: ErpFacePhotoRef) => ('t' in r ? `t:${r.t}` : `a:${r.a}:${r.k}`);

const useFaceData = () =>
  useQuery({ queryKey: ['erp', 'face'], queryFn: erpAuth.face, refetchInterval: usePollInterval(60_000) });

export function FaceKioskScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('skaner');
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const query = useFaceData();
  const canEnroll = query.data?.canEnroll ?? false;
  const tabs = (
    <SegmentedControl<Tab>
      items={[
        { key: 'skaner', label: 'Skaner', icon: 'scan-line' },
        { key: 'jadval', label: 'Jadval', icon: 'clipboard-list' },
        ...(canEnroll ? [{ key: 'yuzlar' as const, label: 'Yuzlar', icon: 'user-plus' as const }] : []),
      ]}
      value={tab}
      onChange={setTab}
    />
  );
  return (
    <>
      {tab === 'jadval'
        ? <StaffAttendanceScreen onBack={onBack} title="Davomat" overline="Face ID · jadval" top={tabs} />
        : <FaceBody tab={tab} tabs={tabs} query={query} onBack={onBack} onPhoto={setViewer} />}
      <PhotoViewer viewer={viewer} onClose={() => setViewer(null)} />
    </>
  );
}

function FaceBody({ tab, tabs, query, onBack, onPhoto }: {
  tab: Exclude<Tab, 'jadval'>; tabs: React.ReactNode; query: ReturnType<typeof useFaceData>; onBack: () => void; onPhoto: (v: Viewer) => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const raise = useHeaderRaise();
  const d = query.data;
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title="Davomat" overline="Face ID · yuz bilan davomat" onBack={onBack} raised={raise.raised} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl * 3, gap: space.stack }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.brand} />}
      >
        {tabs}
        {query.error && !d ? (
          <EmptyState icon="cloud-off" title="Davomat ochilmadi" hint={errorText(query.error)} onRetry={() => void query.refetch()} />
        ) : (
          <Reveal loading={query.isLoading || !d} skeleton={<SkeletonList rows={5} />} replay={tab}>
            {d ? (tab === 'skaner' ? <ScannerTab key="s" d={d} onPhoto={onPhoto} /> : <RosterTab key="r" d={d} onPhoto={onPhoto} />) : null}
          </Reveal>
        )}
      </ScrollView>
    </View>
  );
}

// ───────────────────────── Skaner (kiosk) ─────────────────────────

function ScannerTab({ d, onPhoto }: { d: ErpFaceData; onPhoto: (v: Viewer) => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<ErpFaceMode>('auto');
  const [continuous, setContinuous] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const inCount = d.log.filter((r) => r.kind === 'in').length;
  const outCount = d.log.length - inCount;

  const run = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      let again = true;
      while (again) {
        let res: ErpFaceScanResult | null = null;
        const r = await scanFace({
          title: mode === 'in' ? 'Keldi — yuz skaneri' : mode === 'out' ? 'Ketdi — yuz skaneri' : 'Davomat — yuz skaneri',
          facing: 'front',
          allowFlip: true,
          holdMs: KIOSK_HOLD_MS,
          challenge: erpAuth.faceChallenge,
          verify: async (shot) => {
            try {
              res = await erpAuth.faceScan({ mode, ...facePayload(shot) });
            } catch (e) {
              return { ok: false, message: errText(e) };
            }
            if (!res.ok) return { ok: false, message: res.error };
            return { ok: true, message: `${res.employee.fullName}\n${res.text}${res.hint ? ` · ${res.hint}` : ''}` };
          },
        });
        void qc.invalidateQueries({ queryKey: ['erp', 'face'] });
        void qc.invalidateQueries({ queryKey: ['erp', 'att-day'] });
        const done = res as ErpFaceScanResult | null;
        if (r.ok && done?.ok && !continuous) toast.success(`${done.employee.fullName} — ${done.text}`, 'Davomat');
        again = continuous && r.ok;
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.stack }}>
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconTile icon="scan-line" module="brand" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="titleMd">Yuz bilan davomat</Txt>
            <Txt v="caption">Telefonni xodimlar o&apos;tadigan joyga qo&apos;ying. Xodim kameraga qaraydi — tizim uni taniydi va kelish/ketish vaqtini tabelga yozadi.</Txt>
          </View>
        </View>
        <ChipGroup items={MODES} value={mode} onChange={setMode} />
        <Toggle value={continuous} onChange={setContinuous} label="Uzluksiz skaner" hint="Har xodimdan keyin kamera keyingisi uchun o'zi qayta ochiladi" />
        <Button size="xl" icon="scan-line" title="Skanerni boshlash" loading={busy} onPress={() => void run()} />
        {d.enrolled != null && d.roster ? (
          <Txt v="caption" align="center">Yuzi ro&apos;yxatda: {d.enrolled} / {d.roster.length} xodim</Txt>
        ) : null}
      </Card>

      <KpiGrid
        items={[
          { label: 'Keldi', value: inCount, icon: 'log-in', tone: inCount ? 'success' : undefined },
          { label: 'Ketdi', value: outCount, icon: 'log-out' },
        ]}
      />

      <SectionHead title="Bugungi jurnal" count={d.log.length || undefined} icon="clock" />
      {d.log.length ? (
        <ListGroup>
          {d.log.map((r) => {
            const ref: ErpFacePhotoRef = { a: r.attendanceId, k: r.kind };
            const title = r.employee.fullName;
            const sub = `${r.kind === 'in' ? 'Keldi' : 'Ketdi'} ${r.time} · ${r.employee.position}`;
            return (
              <ListItem
                key={r.key}
                leading={r.photo ? <Thumb photoRef={ref} name={title} onPress={() => onPhoto({ ref, title, sub })} /> : <Avatar name={title} />}
                title={title}
                subtitle={r.employee.position}
                value={r.time}
                badge={{ text: r.kind === 'in' ? 'Keldi' : 'Ketdi', tone: r.kind === 'in' ? 'success' : 'info' }}
                onPress={r.photo ? () => onPhoto({ ref, title, sub }) : undefined}
              />
            );
          })}
        </ListGroup>
      ) : (
        <EmptyState compact icon="scan-line" title="Bugun hali hech kim skaner qilinmadi" hint="«Skanerni boshlash» ni bosing" />
      )}
    </View>
  );
}

// ───────────────────────── Yuzlarni ro'yxatga olish ─────────────────────────

type RosterFilter = 'all' | 'yes' | 'no';

function RosterTab({ d, onPhoto }: { d: ErpFaceData; onPhoto: (v: Viewer) => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<RosterFilter>('all');
  const busyRef = useRef(false);
  const roster = useMemo(() => d.roster ?? [], [d.roster]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return roster.filter((r) =>
      (filter === 'all' || (filter === 'yes' ? r.samples > 0 : r.samples === 0)) &&
      (!s || r.fullName.toLowerCase().includes(s) || r.position.toLowerCase().includes(s)));
  }, [roster, q, filter]);
  const yes = roster.filter((r) => r.samples > 0).length;

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['erp', 'face'] }); };

  const enroll = async (r: ErpFaceRosterRow) => {
    if (busyRef.current) return;
    busyRef.current = true;
    let note: string | null = null;
    try {
      const res = await scanFace({
        title: `${r.fullName} — yuzni ro'yxatga olish`,
        facing: 'back', // otdel kadr telefonni xodimga qaratadi; o'zi uchun almashtirsa bo'ladi
        allowFlip: true,
        challenge: erpAuth.faceChallenge,
        verify: async (shot) => {
          try {
            const x = await erpAuth.faceEnroll({ employeeId: r.id, consent: true, ...facePayload(shot) });
            if (!x.ok) return { ok: false, message: x.error };
            note = x.note;
            return { ok: true, message: x.note };
          } catch (e) {
            return { ok: false, message: errText(e) };
          }
        },
      });
      if (res.ok) toast.success(note ?? "Yuz ro'yxatga olindi", 'Davomat');
      refresh();
    } finally {
      busyRef.current = false;
    }
  };

  const askEnroll = (r: ErpFaceRosterRow) =>
    dialog(
      r.samples ? 'Yuzni qayta olish' : "Yuzni ro'yxatga olish",
      `${r.fullName} roziligini oldingizmi? Yuz ma'lumoti faqat davomat uchun ishlatiladi.${r.samples ? ' Eski namunalar almashtiriladi.' : ''}\n\nXodim kameraga qaraydi va ekrandagi topshiriqni bajaradi.`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        { text: 'Rozi — boshlash', onPress: () => void enroll(r) },
      ],
    );

  const askDelete = (r: ErpFaceRosterRow) =>
    dialog("Yuz ma'lumotini o'chirish", `${r.fullName} yuz namunalari o'chiriladi — skaner uni tanimay qoladi.`, [
      { text: 'Bekor qilish', style: 'cancel' },
      {
        text: "O'chirish",
        style: 'destructive',
        onPress: () => void (async () => {
          try {
            const x = await erpAuth.faceDelete(r.id);
            if (x.ok) toast.success(x.note); else toast.error(x.error);
          } catch (e) {
            toast.error(errText(e));
          }
          refresh();
        })(),
      },
    ]);

  const open = (r: ErpFaceRosterRow) => {
    if (!r.samples) { askEnroll(r); return; }
    dialog(r.fullName, `${r.position} · yuzi ro'yxatda (${r.samples} namuna)`, [
      ...(r.templatePhotoId ? [{ text: "Kadrni ko'rish", onPress: () => onPhoto({ ref: { t: r.templatePhotoId! }, title: r.fullName, sub: r.position }) }] : []),
      { text: 'Qayta olish', onPress: () => askEnroll(r) },
      { text: "O'chirish", style: 'destructive' as const, onPress: () => askDelete(r) },
      { text: 'Yopish', style: 'cancel' as const },
    ]);
  };

  return (
    <View style={{ gap: space.stack }}>
      <KpiGrid
        items={[
          { label: "Ro'yxatda", value: yes, icon: 'user-check', tone: 'success', onPress: () => setFilter('yes') },
          { label: "Ro'yxatda emas", value: roster.length - yes, icon: 'user-x', tone: roster.length - yes ? 'warning' : undefined, onPress: () => setFilter('no') },
        ]}
      />
      <ChipGroup
        items={[
          { key: 'all', label: 'Hammasi', count: roster.length },
          { key: 'no', label: "Ro'yxatda emas", count: roster.length - yes },
          { key: 'yes', label: "Ro'yxatda", count: yes },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {roster.length > 8 ? <SearchField value={q} onChangeText={setQ} placeholder="Ism yoki lavozim" /> : null}
      {rows.length ? (
        <ListGroup>
          {rows.map((r) => (
            <ListItem
              key={r.id}
              leading={r.templatePhotoId
                ? <Thumb photoRef={{ t: r.templatePhotoId }} name={r.fullName} onPress={() => onPhoto({ ref: { t: r.templatePhotoId! }, title: r.fullName, sub: r.position })} />
                : <Avatar name={r.fullName} />}
              title={r.fullName}
              subtitle={r.position}
              badge={r.samples ? { text: "Ro'yxatda", tone: 'success' } : { text: "Yo'q", tone: 'neutral' }}
              onPress={() => open(r)}
            />
          ))}
        </ListGroup>
      ) : (
        <EmptyState compact icon="users" title={roster.length ? "Bu filtrda xodim yo'q" : "Faol xodim yo'q"} />
      )}
      <Txt v="caption" align="center">Xodimni bosing — yuzini ro&apos;yxatga oling. Rasmni bosing — to&apos;liq ekranda.</Txt>
    </View>
  );
}

// ───────────────────────── Kadrlar ─────────────────────────

const usePhoto = (ref: ErpFacePhotoRef | null) =>
  useQuery({
    queryKey: ['erp', 'face-photo', ref ? refKey(ref) : ''],
    queryFn: () => erpAuth.facePhoto(ref!),
    enabled: !!ref,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });

/** Ro'yxatdagi kichik kadr — bosilsa to'liq ekranda. */
function Thumb({ photoRef, name, onPress }: { photoRef: ErpFacePhotoRef; name: string; onPress: () => void }) {
  const { c } = useTheme();
  const p = usePhoto(photoRef);
  const s = size.avatar;
  return (
    <Pressable onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel={`${name} — kadrni ochish`} hitSlop={6}>
      {p.data?.data
        ? <Image source={{ uri: p.data.data }} style={{ width: s, height: s, borderRadius: radius.md, backgroundColor: c.bgMuted }} accessibilityIgnoresInvertColors />
        : <View style={{ width: s, height: s, borderRadius: radius.md, backgroundColor: c.bgMuted }} />}
    </Pressable>
  );
}

/** To'liq ekranli kadr — qora fon, rasm sig'adigan qilib, pastda ism va vaqt. */
function PhotoViewer({ viewer, onClose }: { viewer: Viewer | null; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const p = usePhoto(viewer?.ref ?? null);
  return (
    <Modal visible={!!viewer} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: c.bgInverse }}>
        {p.data?.data ? (
          <Image source={{ uri: p.data.data }} resizeMode="contain" style={{ flex: 1, width: '100%' }} accessibilityLabel={viewer?.title} accessibilityIgnoresInvertColors />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {p.error ? <Txt v="body" color="onSolid">{errText(p.error)}</Txt> : <ActivityIndicator color={c.textOnInverse} size="large" />}
          </View>
        )}
        <View style={{ position: 'absolute', top: insets.top + space.sm, right: space.pageX }}>
          <IconButton icon="x" label="Yopish" onPress={onClose} variant="secondary" />
        </View>
        {viewer ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.pageX, paddingTop: space.lg, paddingBottom: insets.bottom + space.lg, backgroundColor: c.scrim, gap: space.xs }}>
            <Txt v="titleMd" color="onSolid" numberOfLines={1}>{viewer.title}</Txt>
            {viewer.sub ? <Badge label={viewer.sub} tone="neutral" style={{ alignSelf: 'flex-start' }} /> : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
