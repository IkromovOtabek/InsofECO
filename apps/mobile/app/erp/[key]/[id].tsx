import React, { useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, FitTxt, KVList, Timeline, Txt, statusTone } from '@/design/primitives';
import { ReceiptBody, Sheet, dialog, receipt, result, toast, type IconName } from '@/design/ui';
import { PageHeader, Reveal, SkeletonList, StickyActionBar } from '@/design/blocks';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ErpField, ErpSection } from '@/core/erp';
import type { ErpAction } from '@/core/erp';
import { ApiException } from '@/core/api';
import { useErpAction, useErpDetail } from '@/features/erp/api';
import { flushErpGps, pushErpFix, refreshErpPosition, startErpTracking, stopErpTracking } from '@/core/erp-track';
import { erpAuth } from '@/core/erp';
import { useSession } from '@/core/session';
import { confirmAtSite } from '@/features/address/site-check';
import { openNavigation } from '@/core/navigate';
import { ActionSheet } from '@/features/erp/action-sheet';
import { ROW_ICON, RowsGroup, SectionEmpty, SectionHead, idSeg, listModule, splitValue, statusLabel } from '@/features/erp/ui';
import { useHeaderRaise } from '@/design/motion';
import { TripTrackSection, hasTrack, useErpTripTrack } from '@/features/erp/trip-track';
import { useMapScrollLock } from '@/core/map';
import { scanFace } from '@/features/erp/face-scan';
import i18n from '@/core/i18n';

/**
 * Insof ERP hujjat kartochkasi — barcha bo'limlar uchun bitta ekran.
 * Maydonlar ham, tugmalar ham serverdan keladi (`/api/mobile/detail`), shuning uchun
 * yangi amal qo'shilsa ilovani qayta chiqarish shart emas.
 */
/** Tugma ikonkalari — amal nimani anglatishini bir qarashda ko'rsatadi. */
const ACTION_ICON: Record<string, IconName> = {
  'order.confirm': 'circle-check',
  'order.unblock': 'lock-open',
  'order.cancel': 'circle-x',
  'trip.loaded': 'package',
  'trip.onroad': 'navigation',
  'trip.route': 'map',
  'trip.delivered': 'flag',
  'trip.cancel': 'circle-x',
  'trip.eco': 'smartphone',
  // Logistika TZ: obyekt bosqichlari, muammo, yoqilg'i, yopish (ERP /api/mobile/detail yuboradi)
  'trip.arrived': 'map-pin',
  'trip.unloading': 'hourglass',
  'trip.returned': 'truck',
  'trip.problem': 'triangle-alert',
  'trip.fuel': 'droplets',
  'trip.close': 'circle-check',
  'trip.resolve': 'circle-check',
  'invoice.pay': 'banknote',
  // Sex: davomat va kunlik hisobot
  'att.present': 'user-check',
  'att.checkout': 'log-out',
  'att.absent': 'user-x',
  'att.status': 'clock',
  'att.all': 'users',
  'att.form': 'user-check',
  'report.submit': 'clipboard-check',
  'sex.assign': 'hard-hat',
  // Brigadir: smena, ish bosqichlari, muammo va brak
  'shift.open': 'log-in', 'shift.close': 'clipboard-check', 'shift.defect': 'circle-x', 'task.defect': 'circle-x',
  'task.start': 'hammer', 'task.finish': 'circle-check',
  'issue.equipment': 'wrench', 'issue.material': 'package', 'issue.staff': 'user-plus', 'issue.other': 'triangle-alert', 'issue.resolve': 'circle-check', 'issue.remind': 'bell',
  // Ta'minot zanjiri va direktor qarorlari
  'supply.approve': 'circle-check', 'supply.director': 'circle-check', 'supply.fund': 'banknote', 'supply.reject': 'circle-x',
  'supply.price': 'tag', 'supply.receive': 'package-check', 'supply.fact': 'pencil', 'supply.delivery': 'truck', 'supply.incident': 'triangle-alert',
  'supply.incident.resolve': 'circle-check', 'supply.doc': 'camera', 'supply.quote': 'files', 'supply.quote.choose': 'check', 'supply.meta': 'settings',
  'order.invoice': 'receipt', 'problem.assign': 'send', 'problem.note': 'pencil',
};

/**
 * Muvaffaqiyat oynasining sarlavhasi — umumiy "Bajarildi" emas, aniq nima bo'lgani.
 * Faqat server amalni QABUL QILGANDAN keyin ko'rsatiladi (rad etsa — catch).
 */
const SUCCESS_TITLE: Record<string, string> = {
  'trip.arrived': 'Obyektga yetib keldingiz',
  'trip.delivered': 'Yetkazildi — reys yopildi',
  'trip.unloading': 'Tushirish boshlandi',
  'trip.loaded': 'Yuklandi',
  'trip.onroad': "Yo'lga chiqdingiz",
  'trip.returned': 'Zavodga qaytdingiz',
  'trip.close': 'Reys yopildi',
  'order.confirm': 'Zayavka tasdiqlandi',
  'order.cancel': 'Zayavka bekor qilindi',
};
/** Haydovchi obyektda turgani tekshiriladigan amallar (server ham tekshiradi — bu darhol va tushunarli javob uchun). */
const SITE_ACTIONS: Record<string, string> = { 'trip.arrived': 'Yetib keldim', 'trip.unloading': 'Tushirishni boshladim', 'trip.delivered': 'Yetkazdim' };

/** Hujjat turi — kartochka ustki yozuvi (demo "BETON M300 · 12 M³" o'rnida tur nomi). */
const KIND_LABEL: Record<string, string> = {
  orders: 'Zayavka', approvals: 'Tasdiq', invoices: 'Schyot', payments: "To'lov", cashflow: 'Kirim-chiqim', trips: 'Reys',
  supply: "Ta'minot", snabjeniye: "Ta'minot", receipts: 'Kirim', stock: 'Xomashyo', production: 'Zames', tasks: 'Topshiriq',
  customers: 'Mijoz', leads: 'Ariza', employees: 'Xodim', drivers: 'Haydovchi', brigades: 'Brigada', suppliers: 'Yetkazuvchi',
  'brig-issues': 'Muammo', 'brig-shifts': 'Smena', 'prod-report': 'Hisobot',
  problem: 'Egasi qarori', activity: 'Xodim faoliyati', 'brig-issue': 'Muammo', 'brig-shift': 'Smena',
};

/** Katta summa qatori: "Summa", "Jami", "To'lov summasi"… — raqamli bo'lsa kartochka tepasida katta yoziladi. */
const AMOUNT_RE = /^(jami|summa|umumiy summa|to'lov summasi|zayavka summasi|narxi?|qiymati|miqdori)\b/i;
const pickAmount = (fields: ErpField[]) => fields.find((f) => AMOUNT_RE.test(f.label.trim()) && /\d/.test(f.value)) ?? null;

/** "Jarayon" — tarix/bosqich bo'limi bo'lsa Timeline bo'lib chiziladi. */
const PROCESS_RE = /^(jarayon|tarix|bosqich|holatlar|harakat tarixi|history)/i;
const timelineSteps = (s: ErpSection) => s.rows.map((r) => ({
  title: r.title,
  sub: [r.subtitle, r.right].filter(Boolean).join(' · ') || undefined,
  // Server toni: brand — joriy bosqich, qolgani o'tgan
  state: (r.tone === 'brand' ? 'now' : 'done') as 'done' | 'now' | 'todo',
}));

export default function ErpDetail() {
  const { key, id } = useLocalSearchParams<{ key: string; id: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const raise = useHeaderRaise();
  const nav = useNavigation();
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useErpDetail(key!, id!);
  const run = useErpAction();
  const [form, setForm] = useState<ErpAction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  /** Obyekt yonidami — tekshirilmoqda (GPS bir necha soniya oladi; tugma qayta bosilmasin). */
  const [checking, setChecking] = useState(false);
  const inFlight = useRef(false);
  const isDriver = useSession((s) => s.kind === 'erp' && s.erp?.role === 'DRIVER');
  // Reysning yurilgan yo'li (eski serverda yo'q — bo'lim ko'rinmaydi); xarita surilganda sahifa aylanmasin
  const track = useErpTripTrack(key === 'trips' ? id : null, { live: true });
  const mapLock = useMapScrollLock();

  // Demo sarlavhasi (orqaga · raqam · ko'proq) ekranning o'zida — navigator sarlavhasi yashiriladi
  React.useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  /**
   * Amaldan keyingi ish — serverdagi `effect` aytadi (kuzatuv, marshrut, navigatsiya).
   * Tartib muhim: marshrut ekrani ustiga chiqadi, shuning uchun kuzatuv avval yoqiladi.
   */
  const applyEffect = async (a: ErpAction): Promise<string | null> => {
    const e = a.effect;
    if (!e) return null;
    let note: string | null = null;
    if (e.track === 'start') {
      const bg = await startErpTracking(id!);
      if (!bg) note = 'Joylashuv fon rejimida ruxsat etilmagan — ilova yopilsa iz uzilib qoladi.';
    }
    if (e.track === 'stop') await stopErpTracking();
    // Marshrut ilova ichida ko'rsatiladi; tashqi navigator faqat `route` bo'lmaganda
    // (eski server javobi) — haydovchini ilovadan olib chiqib ketmaslik uchun.
    if (e.route) router.push(`/yolda/${id}` as never);
    else if (e.navigate && !(await openNavigation(e.navigate.lat, e.navigate.lng, e.navigate.label))) {
      note = note ?? 'Navigatsiya ilovasi topilmadi.';
    }
    return note;
  };

  const execute = async (a: ErpAction, payload?: Record<string, unknown>) => {
    // Tez ikki marta bosish (forma "Saqlash"i `loading` bo'lib ulgurmasdan) amalni ikki marta yubormasin
    if (inFlight.current) return;
    inFlight.current = true;
    let res: Awaited<ReturnType<typeof run.mutateAsync>> | null;
    try {
      // Reysni yopadigan amal (`track: 'stop'`) — avval yo'l izini yuboramiz: server
      // "obyektga yetib keldimi?" degan qoidani oxirgi saqlangan nuqta bo'yicha tekshiradi.
      if (a.effect?.track === 'stop') await flushErpGps();
      // Obyekt yonida tasdiqlangan nuqta amalning o'zida ham ketadi: ERP 300 m qoidasini
      // shu koordinata bilan tekshiradi (koordinatasiz yangi server "ilovani yangilang" deydi)
      const at = SITE_ACTIONS[a.id] ? siteFixRef.current : null;
      const body = at ? { ...(payload ?? {}), lat: at.lat, lng: at.lng } : payload;
      // `local` amal serverga bormaydi — u faqat ilova ichidagi ish (marshrutni ochish)
      res = a.local ? null : await run.mutateAsync({ action: a.id, id: id!, payload: body });
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring';
      if (a.form?.length) setFormError(msg); else result.error('Bajarilmadi', msg);
      return;
    } finally {
      inFlight.current = false;
    }
    // Shu yerdan pastda amal serverda BAJARILGAN. Effekt (kuzatuv, marshrut) xatosi "Bajarilmadi"
    // deb ko'rsatilmasligi kerak — aks holda haydovchi tugmani qayta bosib, amalni takrorlaydi.
    setForm(null);
    let note: string | null = null;
    try { note = await applyEffect(a); } catch { note = "Amal bajarildi, lekin joylashuv kuzatuvi yoki marshrut ochilmadi — kartochkani yangilang."; }
    const message = res?.message ?? null;
    const title = SUCCESS_TITLE[a.id] ?? 'Bajarildi';
    // Ogohlantirish bo'lsa o'qib chiqilishi kerak — toast o'zi yo'qolib ketadi
    if (note) dialog(message || SUCCESS_TITLE[a.id] ? title : 'Diqqat', message ? `${message}\n\n${note}` : note);
    // Muhim amal (zayavka qabul qilindi) — server chek yuborsa, katta chek oynasi
    else if (res?.receipt) receipt.show(res.receipt);
    else if (message || SUCCESS_TITLE[a.id]) result.success(title, message || `${a.label} — qayd etildi`);
  };

  /** `siteGate` tasdiqlagan nuqta — keyingi `execute` uni amal bilan birga yuboradi. */
  const siteFixRef = useRef<{ lat: number; lng: number } | null>(null);

  /**
   * Haydovchining "Yetib keldim" / "Yetkazdim" — avval YANGI GPS nuqta bilan obyekt yonidami
   * (`SITE_RADIUS_M`). Obyekt nuqtasi marshrutdan olinadi; topilmasa (internet, eski server) —
   * tekshirib bo'lmaydi va qarorni server qiladi. `false` — haydovchi to'xtatdi.
   */
  const siteGate = async (a: ErpAction): Promise<boolean> => {
    siteFixRef.current = null;
    if (!isDriver || key !== 'trips' || a.local || !SITE_ACTIONS[a.id]) return true;
    setChecking(true);
    try {
      const dest = await erpAuth.tripRoute(id!, undefined, true).then((r) => r.destination).catch(() => null);
      const here = await confirmAtSite(dest, SITE_ACTIONS[a.id]!);
      if (here === null) return false;
      siteFixRef.current = here ? { lat: here.lat, lng: here.lng } : null;
      // Tasdiqlangan nuqta serverga — uning qoidasi oxirgi saqlangan nuqtaga qaraydi
      if (here) await pushErpFix({ lat: here.lat, lng: here.lng, at: here.at, accuracyM: here.accuracyM }).catch(() => undefined);
      return true;
    } finally {
      setChecking(false);
    }
  };

  /**
   * Yopiq tugmani ochishga urinish: hozirgi joylashuvni olib serverga yuboramiz va
   * kartochkani qayta so'raymiz. Qoida oxirgi SAQLANGAN nuqtaga qaraydi, u esa ilova
   * yopiq turgan vaqtda eskirib qolgan bo'lishi mumkin.
   */
  const recheck = async () => {
    const ok = await refreshErpPosition(id!);
    await refetch();
    if (!ok) toast.error("GPS yoqilganini va ilovaga joylashuv ruxsati berilganini tekshiring.", 'Joylashuv topilmadi');
  };

  const press = async (a: ErpAction) => {
    // Bitta amal bajarilayotganda ikkinchisi (yonidagi tugma) ishga tushmasin
    if (run.isPending || checking) return;
    setFormError(null);
    // Yopiq tugma bosilsa sababini aytamiz va qulfni ochishga urinib ko'ramiz —
    // xabarni o'qib, hech narsa qila olmay qolish eng yomoni
    if (a.disabled) {
      dialog(a.label, a.hint ?? 'Hozir bajarib bo\'lmaydi', [
        { text: 'Yopish', style: 'cancel' },
        { text: 'Qayta tekshirish', onPress: () => void recheck() },
      ]);
      return;
    }
    if (!(await siteGate(a))) return;
    // "Keldi — yuz skaneri": ilova ichidagi skaner (orqa kamera — rahbar xodimga qaratadi; almashtirish tugmasi bor);
    // kadr o'zi olinadi va skaner ochiq turganda server profil surati bilan solishtiradi — natija skaner ichida
    if (a.id === 'att.face') {
      if (inFlight.current) return;
      inFlight.current = true;
      let message: string | null = null;
      try {
        const r = await scanFace({
          title: data?.title ?? 'Yuz skaneri',
          facing: 'back', // rahbar xodimning yuzini skanerlaydi — orqa kamera; o'zi uchun almashtirsa bo'ladi
          allowFlip: true,
          verify: async (photo) => {
            try {
              // Bir martalik challenge (eski ERP serverida yo'q bo'lsa — nonce'siz)
              const nonce = await erpAuth.faceNonce();
              const res = await run.mutateAsync({ action: a.id, id: id!, payload: { photo, ...(nonce ? { nonce } : {}) } });
              message = res?.message ?? null;
              return { ok: true, message: message ?? undefined };
            } catch (e) {
              return { ok: false, message: e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring' };
            }
          },
        });
        if (r.ok) toast.success(message ?? 'Keldi deb belgilandi', 'Davomat');
      } finally {
        inFlight.current = false;
      }
      return;
    }
    if (a.form?.length) { setForm(a); return; }
    if (a.confirm) {
      dialog(a.label, a.confirm, [
        { text: i18n.t('ui.cancel'), style: 'cancel' },
        { text: a.label, style: a.tone === 'danger' ? 'destructive' : 'default', onPress: () => void execute(a) },
      ]);
      return;
    }
    void execute(a);
  };

  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp }}>
        <PageHeader title="Kartochka" onBack={back} style={{ paddingTop: insets.top + space.sm }} />
        <View style={{ flex: 1, justifyContent: 'center', padding: space.pageX }}>
          <EmptyState icon="cloud-off" title="Kartochka ochilmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void refetch()} />
        </View>
      </View>
    );
  }

  /** Amal tugmasi varianti — server toni bo'yicha. */
  const variantOf = (a: ErpAction) => (a.tone === 'danger' ? 'danger' : a.tone === 'success' ? 'success' : 'primary') as 'danger' | 'success' | 'primary';
  /**
   * Demo `.sticky`: "Yana" (qolgan amallar) · ikkilamchi · asosiy.
   * Asosiy — server tartibidagi birinchi "ijobiy" amal (Tasdiqlash, Blokni ochish, Yetkazdim — yopiq bo'lsa ham,
   * sababi bilan); ikkilamchi — salbiy amal (Rad etish / Bekor qilish), bo'lmasa keyingisi; qolgani "Yana"da.
   * Ilgari birinchi amal ko'r-ko'rona asosiy bo'lardi: server faqat "Bekor qilish"ni bersa yoki u birinchi
   * kelsa, qizil tugma asosiy bo'lib, tasdiqlash ko'rinmay qolardi.
   */
  const acts = data?.actions ?? [];
  const negative = (a: ErpAction) => a.tone === 'danger';
  const primary = acts.find((a) => !negative(a)) ?? acts[0];
  const secondary = acts.find((a) => a !== primary && negative(a)) ?? acts.find((a) => a !== primary);
  const sheetActions = acts.filter((a) => a !== primary && a !== secondary);
  const amount = data && !data.receipt ? pickAmount(data.fields) : null;
  const amountVal = amount ? splitValue(amount.value) : null;
  const kv = data ? data.fields.filter((f) => f !== amount) : [];
  const process = data?.sections.find((x) => PROCESS_RE.test(x.title) && x.rows.length) ?? null;
  const sections = data?.sections.filter((x) => x !== process) ?? [];
  const kind = KIND_LABEL[key!];

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader
        title={data?.title ?? kind ?? 'Kartochka'}
        onBack={back}
        raised={raise.raised}
        actions={sheetActions.length ? [{ icon: 'ellipsis', label: 'Yana amallar', onPress: () => setMoreOpen(true) }] : undefined}
        style={{ paddingTop: insets.top + space.sm }}
      />
      <ScrollView
        scrollEnabled={mapLock.scrollEnabled}
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        <Reveal loading={isLoading || !data} skeleton={<View style={{ gap: space.stack }}><SkeletonList rows={2} /><SkeletonList rows={4} /></View>}>
          {data?.receipt ? (
            /* Pul hujjati — sarlavha va maydonlar o'rniga chek: server nima bersa shu chiziladi */
            <Card key="receipt">
              <ReceiptBody data={data.receipt} compact />
            </Card>
          ) : data ? (
            /* Demo xulosa kartasi: ustki yozuv + holat nishoni, katta summa, ostida izoh */
            <Card key="sum" style={{ gap: space.sm }}>
              {kind || data.status ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Txt v="appbarOverline" numberOfLines={1} style={{ flex: 1 }}>{kind ?? ''}</Txt>
                  {data.status ? <Badge label={statusLabel(data.status)} tone={statusTone(data.status)} /> : null}
                </View>
              ) : null}
              {amountVal ? (
                <FitTxt v="heroValue" min={0.7} text={`${amountVal.num}${amountVal.unit ? ` ${amountVal.unit}` : ''}`} style={{ color: c.textStrong }}>
                  {amountVal.num}
                  {amountVal.unit ? <Txt v="heroUnit" color="muted">{` ${amountVal.unit}`}</Txt> : null}
                </FitTxt>
              ) : (
                <Txt v="titleLg" numberOfLines={2}>{data.title}</Txt>
              )}
              {data.subtitle ? <Txt v="tSm" numberOfLines={2}>{data.subtitle}</Txt> : null}
            </Card>
          ) : null}

          {kv.length ? <KVList key="kv" rows={kv.map((f) => ({ label: f.label, value: f.value, tone: f.tone }))} /> : null}

          {hasTrack(track.data) ? <TripTrackSection key="track" t={track.data} onTouchLock={mapLock.onTouchLock} /> : null}

          {process ? <SectionHead key="tl-h" title="Jarayon" /> : null}
          {process ? <Card key="tl"><Timeline steps={timelineSteps(process)} /></Card> : null}

          {sections.flatMap((s) => [
            <SectionHead key={`h-${s.title}`} title={s.title} count={s.rows.length || undefined} />,
            s.rows.length === 0 ? <SectionEmpty key={`e-${s.title}`} text={s.empty} /> : (
              <RowsGroup
                key={`r-${s.title}`}
                rows={s.rows}
                module={listModule(s.target)}
                icon={s.icon ?? ROW_ICON[s.target ?? ''] ?? 'circle'}
                // Qatorning `open`i — ro'yxat (masalan muammoning "Bog'liq bo'lim"i), aks holda bo'lim kartochkasi
                onRow={(r) => (r.open ? () => router.push(`/erp/list/${r.open}` as never)
                  : s.target ? () => router.push(`/erp/${s.target}/${idSeg(r.id)}` as never) : undefined)}
              />
            ),
          ])}
        </Reveal>
      </ScrollView>

      {/* Yopiq asosiy amal: sababi va qulfni ochishga urinish (joylashuvni qayta yuborish) — panel ustida */}
      {primary?.disabled ? (
        <View style={{ alignItems: 'center', paddingHorizontal: space.pageX, paddingTop: space.sm, gap: space.xs }}>
          {primary.hint ? <Txt v="caption" align="center">{primary.hint}</Txt> : null}
          <Button variant="ghost" icon="refresh-cw" title="Qayta tekshirish" full={false} onPress={() => void recheck()} />
        </View>
      ) : null}
      {primary ? (
        <StickyActionBar
          primary={{
            title: primary.label,
            icon: ACTION_ICON[primary.id] ?? 'arrow-right',
            variant: variantOf(primary),
            disabled: primary.disabled,
            disabledReason: primary.hint ?? "Hozir bajarib bo'lmaydi",
            loading: run.isPending || checking,
            onPress: () => void press(primary),
          }}
          secondary={secondary ? { title: secondary.label, icon: secondary.disabled ? 'lock' : ACTION_ICON[secondary.id], tone: secondary.tone === 'danger' ? 'danger' : undefined, onPress: () => void press(secondary) } : undefined}
          more={sheetActions.length ? { label: 'Yana amallar', icon: 'ellipsis', onPress: () => setMoreOpen(true) } : undefined}
        />
      ) : null}

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Yana amallar">
        <View style={{ gap: space.md }}>
          {sheetActions.map((a) => (
            <View key={a.id} style={{ gap: space.xs }}>
              {/* Yopiq amal kulrang, lekin bosiladi — sababini aytadi va qayta tekshirishni taklif qiladi */}
              <Button
                size="lg"
                title={a.label}
                icon={a.disabled ? 'lock' : ACTION_ICON[a.id] ?? 'arrow-right'}
                variant={a.disabled || a.tone === 'warning' ? 'secondary' : variantOf(a)}
                disabled={run.isPending || checking}
                onPress={() => { setMoreOpen(false); void press(a); }}
              />
              {a.disabled && a.hint ? <Txt v="caption" align="center">{a.hint}</Txt> : null}
            </View>
          ))}
        </View>
      </Sheet>

      {form ? (
        <ActionSheet
          action={form}
          loading={run.isPending}
          error={formError}
          onClose={() => setForm(null)}
          onSubmit={(payload) => void execute(form, payload)}
        />
      ) : null}
    </View>
  );
}
