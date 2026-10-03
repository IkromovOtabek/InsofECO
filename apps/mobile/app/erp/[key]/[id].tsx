import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, KVList, Timeline, Txt, statusTone } from '@/design/primitives';
import { ReceiptBody, Sheet, dialog, receipt, result, toast, type IconName } from '@/design/ui';
import { PageHeader, Reveal, SkeletonList, StickyActionBar } from '@/design/blocks';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ErpField, ErpSection } from '@/core/erp';
import type { ErpAction } from '@/core/erp';
import { ApiException } from '@/core/api';
import { useErpAction, useErpDetail } from '@/features/erp/api';
import { flushErpGps, refreshErpPosition, startErpTracking, stopErpTracking } from '@/core/erp-track';
import { openNavigation } from '@/core/navigate';
import { ActionSheet } from '@/features/erp/action-sheet';
import { ROW_ICON, RowsGroup, SectionEmpty, SectionHead, listModule, splitValue, statusLabel } from '@/features/erp/ui';
import { useHeaderRaise } from '@/design/motion';

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
  'issue.equipment': 'wrench', 'issue.material': 'package', 'issue.staff': 'user-plus', 'issue.other': 'triangle-alert', 'issue.resolve': 'circle-check',
};

/** Hujjat turi — kartochka ustki yozuvi (demo "BETON M300 · 12 M³" o'rnida tur nomi). */
const KIND_LABEL: Record<string, string> = {
  orders: 'Zayavka', approvals: 'Tasdiq', invoices: 'Schyot', payments: "To'lov", cashflow: 'Kirim-chiqim', trips: 'Reys',
  supply: "Ta'minot", snabjeniye: "Ta'minot", receipts: 'Kirim', stock: 'Xomashyo', production: 'Zames', tasks: 'Topshiriq',
  customers: 'Mijoz', leads: 'Ariza', employees: 'Xodim', drivers: 'Haydovchi', brigades: 'Brigada', suppliers: 'Yetkazuvchi',
  'brig-issues': 'Muammo', 'brig-shifts': 'Smena', 'prod-report': 'Hisobot',
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
    try {
      // Reysni yopadigan amal (`track: 'stop'`) — avval yo'l izini yuboramiz: server
      // "obyektga yetib keldimi?" degan qoidani oxirgi saqlangan nuqta bo'yicha tekshiradi.
      if (a.effect?.track === 'stop') await flushErpGps();
      // `local` amal serverga bormaydi — u faqat ilova ichidagi ish (marshrutni ochish)
      const res = a.local ? null : await run.mutateAsync({ action: a.id, id: id!, payload });
      const message = res?.message ?? null;
      setForm(null);
      const note = await applyEffect(a);
      // Ogohlantirish bo'lsa o'qib chiqilishi kerak — toast o'zi yo'qolib ketadi
      if (message && note) dialog('Bajarildi', `${message}\n\n${note}`);
      // Muhim amal (zayavka qabul qilindi) — server chek yuborsa, katta chek oynasi
      else if (res?.receipt) receipt.show(res.receipt);
      else if (message) result.success('Bajarildi', message);
      else if (note) dialog('Diqqat', note);
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring';
      if (form) setFormError(msg); else result.error('Bajarilmadi', msg);
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

  const press = (a: ErpAction) => {
    // Bitta amal bajarilayotganda ikkinchisi (yonidagi tugma) ishga tushmasin
    if (run.isPending) return;
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
    if (a.form?.length) { setForm(a); return; }
    if (a.confirm) {
      dialog(a.label, a.confirm, [
        { text: 'Bekor', style: 'cancel' },
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
  // Birinchi amal — keyingi qadam (server tartibi). Demo `.sticky`: "…" (qolgan amallar) · ikkilamchi · asosiy.
  const [primary, secondary, ...sheetActions] = data?.actions ?? [];
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
        actions={sheetActions.length ? [{ icon: 'ellipsis', label: 'Boshqa amallar', onPress: () => setMoreOpen(true) }] : undefined}
        style={{ paddingTop: insets.top + space.sm }}
      />
      <ScrollView
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
                <Txt v="heroValue" numberOfLines={1} adjustsFontSizeToFit style={{ color: c.textStrong }}>
                  {amountVal.num}
                  {amountVal.unit ? <Txt v="heroUnit" color="muted">{` ${amountVal.unit}`}</Txt> : null}
                </Txt>
              ) : (
                <Txt v="titleLg" numberOfLines={2}>{data.title}</Txt>
              )}
              {data.subtitle ? <Txt v="tSm" numberOfLines={2}>{data.subtitle}</Txt> : null}
            </Card>
          ) : null}

          {kv.length ? <KVList key="kv" rows={kv.map((f) => ({ label: f.label, value: f.value, tone: f.tone }))} /> : null}

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
                onRow={(r) => (s.target ? () => router.push(`/erp/${s.target}/${r.id}` as never) : undefined)}
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
            loading: run.isPending,
            onPress: () => press(primary),
          }}
          secondary={secondary ? { title: secondary.label, icon: secondary.disabled ? 'lock' : undefined, tone: secondary.tone === 'danger' ? 'danger' : undefined, onPress: () => press(secondary) } : undefined}
          more={sheetActions.length ? { label: 'Boshqa amallar', icon: 'ellipsis', onPress: () => setMoreOpen(true) } : undefined}
        />
      ) : null}

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Amallar">
        <View style={{ gap: space.md }}>
          {sheetActions.map((a) => (
            <View key={a.id} style={{ gap: space.xs }}>
              {/* Yopiq amal kulrang, lekin bosiladi — sababini aytadi va qayta tekshirishni taklif qiladi */}
              <Button
                size="lg"
                title={a.label}
                icon={a.disabled ? 'lock' : ACTION_ICON[a.id] ?? 'arrow-right'}
                variant={a.disabled || a.tone === 'warning' ? 'secondary' : variantOf(a)}
                disabled={run.isPending}
                onPress={() => { setMoreOpen(false); press(a); }}
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
