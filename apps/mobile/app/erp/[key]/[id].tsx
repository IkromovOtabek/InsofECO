import React, { useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { EmptyState, Gap, Txt } from '@/design/primitives';
import { Icon, IconName } from '@/design/ui';
import { useTheme } from '@/design/theme';
import type { ErpAction } from '@/core/erp';
import { ApiException } from '@/core/api';
import { useErpAction, useErpDetail } from '@/features/erp/api';
import { flushErpGps, startErpTracking, stopErpTracking } from '@/core/erp-track';
import { openNavigation } from '@/core/navigate';
import { ActionSheet } from '@/features/erp/action-sheet';
import { Chip, ListRow, ROW_ICON, SectionHead, statusLabel } from '@/features/erp/ui';
import { erpText } from '@/design/tokens';
import { useSession } from '@/core/session';
import { Appear, PressScale, stagger } from '@/design/motion';

/**
 * Insof ERP hujjat kartochkasi — barcha bo'limlar uchun bitta ekran.
 * Maydonlar ham, tugmalar ham serverdan keladi (`/api/mobile/detail`), shuning uchun
 * yangi amal qo'shilsa ilovani qayta chiqarish shart emas.
 */
/** Tugma ikonkalari — amal nimani anglatishini bir qarashda ko'rsatadi. */
const ACTION_ICON: Record<string, IconName> = {
  'order.confirm': 'checkmark-circle',
  'order.unblock': 'lock-open',
  'order.cancel': 'close-circle',
  'trip.loaded': 'cube',
  'trip.onroad': 'navigate',
  'trip.route': 'map',
  'trip.delivered': 'flag',
  'trip.cancel': 'close-circle',
  'trip.eco': 'phone-portrait',
  'invoice.pay': 'cash',
};

export default function ErpDetail() {
  const { key, id } = useLocalSearchParams<{ key: string; id: string }>();
  const { c } = useTheme();
  const nav = useNavigation();
  const router = useRouter();
  const role = useSession((s) => s.erp?.role ?? 'DIRECTOR');
  const { data, isLoading, error, refetch, isRefetching } = useErpDetail(key!, id!);
  const run = useErpAction();
  const [form, setForm] = useState<ErpAction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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
      const message = a.local ? null : (await run.mutateAsync({ action: a.id, id: id!, payload })).message;
      setForm(null);
      const note = await applyEffect(a);
      if (message) Alert.alert('Bajarildi', note ? `${message}\n\n${note}` : message);
      else if (note) Alert.alert('Diqqat', note);
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : 'Tarmoq xatosi';
      if (form) setFormError(msg); else Alert.alert('Bajarilmadi', msg);
    }
  };

  const press = (a: ErpAction) => {
    setFormError(null);
    // Yopiq tugma bosilsa sababini aytamiz — nega ochilmagani noma'lum qolmasin
    if (a.disabled) { Alert.alert(a.label, a.hint ?? 'Hozir bajarib bo\'lmaydi'); return; }
    if (a.form?.length) { setForm(a); return; }
    if (a.confirm) {
      Alert.alert(a.label, a.confirm, [
        { text: 'Bekor', style: 'cancel' },
        { text: a.label, style: a.tone === 'danger' ? 'destructive' : 'default', onPress: () => void execute(a) },
      ]);
      return;
    }
    void execute(a);
  };

  if (isLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.brandPrimary} /></View>;
  if (error || !data) return <EmptyState title="Kartochka ochilmadi" hint="Internetni tekshiring" />;

  const tone = (t?: string) => (t ? { brand: c.brandPrimary, success: c.success, warning: c.warning, danger: c.danger, info: c.info }[t] ?? c.textPrimary : c.textPrimary);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brandPrimary} />}
      >
        <Appear>
          <View style={{ backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Txt style={{ ...erpText.titleLg, color: c.textPrimary }}>{data.title}</Txt>
                {data.subtitle ? <Txt style={{ fontSize: 13.5, color: c.textSecondary, marginTop: 3 }}>{data.subtitle}</Txt> : null}
              </View>
              {data.status ? <Chip label={statusLabel(data.status)} tone={data.status === 'CANCELLED' ? 'danger' : undefined} /> : null}
            </View>
          </View>
        </Appear>
        <Gap h={12} />

        <Appear delay={60}>
          <View style={{ backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 14, overflow: 'hidden' }}>
            {data.fields.map((f, i) => (
              <View key={f.label} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i === data.fields.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
                <Txt style={{ fontSize: 13, color: c.textSecondary, width: 128 }}>{f.label}</Txt>
                <Txt style={{ ...erpText.rowTitle, flex: 1, color: tone(f.tone) }}>{f.value}</Txt>
              </View>
            ))}
          </View>
        </Appear>

        {data.sections.map((s, i) => (
          <Appear key={s.title} delay={stagger(i + 2, 70)} style={{ marginTop: 22 }}>
            <SectionHead title={s.title} />
            {s.rows.length === 0 ? (
              <View style={{ backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 22, alignItems: 'center' }}>
                <Txt style={{ fontSize: 13, color: c.textSecondary }}>{s.empty}</Txt>
              </View>
            ) : s.rows.map((r, j) => (
              <ListRow
                key={r.id}
                row={r}
                index={j}
                role={role}
                icon={ROW_ICON[s.target ?? ''] ?? 'ellipse-outline'}
                onPress={s.target ? () => router.push(`/erp/${s.target}/${r.id}` as never) : undefined}
              />
            ))}
          </Appear>
        ))}

        {data.actions.length ? (
          <Appear delay={stagger(data.sections.length + 2, 70)} style={{ marginTop: 26 }}>
            <SectionHead title="Amallar" />
            {data.actions.map((a) => {
              const col = a.tone === 'danger' ? c.danger : a.tone === 'success' ? c.success : a.tone === 'warning' ? c.warning : c.brandPrimary;
              const soft = a.tone === 'danger' || a.tone === 'warning';
              // Yopiq tugma kulrang bo'ladi, lekin o'rnida qoladi: haydovchi keyingi qadam
              // qaysi tugma ekanini ko'rib turadi, faqat hozir bosib bo'lmasligini biladi.
              const bg = a.disabled ? c.bgSurface : soft ? col + '14' : col;
              const ink = a.disabled ? c.textSecondary : soft ? col : '#FFFFFF';
              return (
                <View key={a.id} style={{ marginBottom: 10 }}>
                  <PressScale onPress={() => press(a)} disabled={run.isPending} haptic={!a.disabled}>
                    <View style={{ height: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: soft || a.disabled ? 1 : 0, borderColor: a.disabled ? c.border : col + '33', opacity: run.isPending ? 0.6 : 1 }}>
                      <Icon name={a.disabled ? 'lock-closed' : ACTION_ICON[a.id] ?? 'arrow-forward'} size={18} color={ink} />
                      <Txt style={{ ...erpText.button, marginLeft: 8, color: ink }}>{a.label}</Txt>
                    </View>
                  </PressScale>
                  {a.disabled && a.hint ? (
                    <Txt style={{ fontSize: 12, color: c.textSecondary, marginTop: 6, textAlign: 'center' }}>{a.hint}</Txt>
                  ) : null}
                </View>
              );
            })}
          </Appear>
        ) : null}
      </ScrollView>

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
