import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, IconTile, ListGroup, Txt, statusTone } from '@/design/primitives';
import { ReceiptBody, Sheet, dialog, receipt, result, toast, type IconName } from '@/design/ui';
import { StickyActionBar } from '@/design/blocks';
import { useTheme } from '@/design/theme';
import { size, space, toneColors } from '@/design/tokens';
import type { ErpAction } from '@/core/erp';
import { ApiException } from '@/core/api';
import { useErpAction, useErpDetail } from '@/features/erp/api';
import { flushErpGps, refreshErpPosition, startErpTracking, stopErpTracking } from '@/core/erp-track';
import { openNavigation } from '@/core/navigate';
import { ActionSheet } from '@/features/erp/action-sheet';
import { ListSkeleton, ROW_ICON, RowsGroup, SectionEmpty, SectionHead, listModule, statusLabel } from '@/features/erp/ui';
import { Appear, stagger } from '@/design/motion';

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

export default function ErpDetail() {
  const { key, id } = useLocalSearchParams<{ key: string; id: string }>();
  const { c } = useTheme();
  const nav = useNavigation();
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useErpDetail(key!, id!);
  const run = useErpAction();
  const [form, setForm] = useState<ErpAction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  React.useEffect(() => {
    if (data) nav.setOptions({ title: data.title });
  }, [data, nav]);

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

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp, padding: space.pageX, gap: space.md }}>
        <ListSkeleton rows={2} />
        <ListSkeleton rows={6} />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bgApp, justifyContent: 'center' }}>
        <EmptyState icon="cloud-off" title="Kartochka ochilmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void refetch()} />
      </View>
    );
  }

  /** Amal tugmasi varianti — server toni bo'yicha. */
  const variantOf = (a: ErpAction) => (a.tone === 'danger' ? 'danger' : a.tone === 'success' ? 'success' : 'primary') as 'danger' | 'success' | 'primary';
  // Birinchi amal — keyingi qadam (server tartibi): pastki panelda katta tugma. Ikkinchisi yonida,
  // uchtadan ko'p bo'lsa qolganlari "Yana" varag'ida.
  const [primary, ...others] = data.actions;
  const secondary = others.length === 1 ? others[0] : undefined;
  const sheetActions = others.length > 1 ? others : [];

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView
        contentContainerStyle={{ padding: space.pageX, paddingBottom: space.x10 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        {data.receipt ? (
          /* Pul hujjati — sarlavha va maydonlar o'rniga chek: server nima bersa shu chiziladi */
          <Appear>
            <Card>
              <ReceiptBody data={data.receipt} compact />
            </Card>
          </Appear>
        ) : (
          <>
            <Appear>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <IconTile icon={ROW_ICON[key!] ?? 'file-text'} module={listModule(key)} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt v="titleMd" numberOfLines={2}>{data.title}</Txt>
                  {data.subtitle ? <Txt v="bodySm" color="muted" style={{ marginTop: space.xs }}>{data.subtitle}</Txt> : null}
                </View>
                {data.status ? <Badge label={statusLabel(data.status)} tone={statusTone(data.status)} /> : null}
              </Card>
            </Appear>

            {data.fields.length ? (
              <Appear delay={stagger(1)} style={{ marginTop: space.md }}>
                <ListGroup>
                  {data.fields.map((f, i) => (
                    <View key={`${f.label}-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.card, paddingVertical: space.md, borderTopWidth: i ? size.hairline : 0, borderTopColor: c.borderSubtle }}>
                      <Txt v="bodySm" color="muted" style={{ flexBasis: '40%', flexShrink: 0 }}>{f.label}</Txt>
                      <Txt v="bodyStrong" align="right" style={{ flex: 1, color: f.tone ? toneColors(c, f.tone).ink : c.textStrong }}>{f.value}</Txt>
                    </View>
                  ))}
                </ListGroup>
              </Appear>
            ) : null}
          </>
        )}

        {data.sections.map((s, i) => (
          <Appear key={s.title} delay={stagger(i + 2)} style={{ marginTop: space.xxl }}>
            <SectionHead title={s.title} count={s.rows.length || undefined} />
            {s.rows.length === 0 ? <SectionEmpty text={s.empty} /> : (
              <RowsGroup
                rows={s.rows}
                module={listModule(s.target)}
                icon={s.icon ?? ROW_ICON[s.target ?? ''] ?? 'circle'}
                onRow={(r) => (s.target ? () => router.push(`/erp/${s.target}/${r.id}` as never) : undefined)}
              />
            )}
          </Appear>
        ))}
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
          secondary={secondary ? { title: secondary.label, icon: secondary.disabled ? 'lock' : ACTION_ICON[secondary.id], onPress: () => press(secondary) } : undefined}
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
