import React, { useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Badge, Button, Card, EmptyState, Gap, Txt, statusTone } from '@/design/primitives';
import { toast, type IconName } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space, toneColors } from '@/design/tokens';
import type { ErpAction } from '@/core/erp';
import { ApiException } from '@/core/api';
import { useErpAction, useErpDetail } from '@/features/erp/api';
import { flushErpGps, refreshErpPosition, startErpTracking, stopErpTracking } from '@/core/erp-track';
import { openNavigation } from '@/core/navigate';
import { ActionSheet } from '@/features/erp/action-sheet';
import { ListRow, ROW_ICON, SectionHead, listModule, statusLabel } from '@/features/erp/ui';
import { SectionEmpty } from '@/features/erp/screens';
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
  'invoice.pay': 'banknote',
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
      // Ogohlantirish bo'lsa o'qib chiqilishi kerak — toast o'zi yo'qolib ketadi
      if (message && note) Alert.alert('Bajarildi', `${message}\n\n${note}`);
      else if (message) toast.success(message, 'Bajarildi');
      else if (note) Alert.alert('Diqqat', note);
    } catch (e) {
      const msg = e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring';
      if (form) setFormError(msg); else toast.error(msg, 'Bajarilmadi');
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
    setFormError(null);
    // Yopiq tugma bosilsa sababini aytamiz va qulfni ochishga urinib ko'ramiz —
    // xabarni o'qib, hech narsa qila olmay qolish eng yomoni
    if (a.disabled) {
      Alert.alert(a.label, a.hint ?? 'Hozir bajarib bo\'lmaydi', [
        { text: 'Yopish', style: 'cancel' },
        { text: 'Qayta tekshirish', onPress: () => void recheck() },
      ]);
      return;
    }
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

  if (isLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.brand} /></View>;
  if (error || !data) return <EmptyState title="Kartochka ochilmadi" hint="Internetni tekshirib, qayta oching" />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: space.pageX, paddingBottom: space.x10 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        <Appear>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Txt v="titleMd">{data.title}</Txt>
                {data.subtitle ? <Txt v="bodySm" color="muted" style={{ marginTop: space.xs }}>{data.subtitle}</Txt> : null}
              </View>
              {data.status ? <Badge label={statusLabel(data.status)} tone={statusTone(data.status)} /> : null}
            </View>
          </Card>
        </Appear>
        <Gap h={space.md} />

        <Appear delay={stagger(1)}>
          <Card style={{ paddingVertical: 0 }}>
            {data.fields.map((f, i) => (
              <View key={f.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.md, borderBottomWidth: i === data.fields.length - 1 ? 0 : size.hairline, borderBottomColor: c.borderSubtle }}>
                <Txt v="bodySm" color="muted" style={{ flexBasis: '40%', flexShrink: 0 }}>{f.label}</Txt>
                <Txt v="bodyStrong" style={{ flex: 1, color: f.tone ? toneColors(c, f.tone).ink : c.textStrong }}>{f.value}</Txt>
              </View>
            ))}
          </Card>
        </Appear>

        {data.sections.map((s, i) => (
          <Appear key={s.title} delay={stagger(i + 2)} style={{ marginTop: space.xxl }}>
            <SectionHead title={s.title} />
            {s.rows.length === 0 ? <SectionEmpty text={s.empty} /> : s.rows.map((r, j) => (
              <ListRow
                key={r.id}
                row={r}
                index={j}
                module={listModule(s.target)}
                icon={ROW_ICON[s.target ?? ''] ?? 'circle'}
                onPress={s.target ? () => router.push(`/erp/${s.target}/${r.id}` as never) : undefined}
              />
            ))}
          </Appear>
        ))}

        {data.actions.length ? (
          <Appear delay={stagger(data.sections.length + 2)} style={{ marginTop: space.xxl }}>
            <SectionHead title="Amallar" />
            <View style={{ gap: space.md }}>
              {data.actions.map((a) => (
                <View key={a.id}>
                  {/* Yopiq tugma kulrang bo'ladi, lekin o'rnida qoladi: haydovchi keyingi qadam
                      qaysi tugma ekanini ko'rib turadi, faqat hozir bosib bo'lmasligini biladi. */}
                  <Button
                    size="lg"
                    title={a.label}
                    icon={a.disabled ? 'lock' : ACTION_ICON[a.id] ?? 'arrow-right'}
                    variant={a.tone === 'danger' ? 'danger' : a.tone === 'warning' ? 'secondary' : 'primary'}
                    disabled={a.disabled || run.isPending}
                    onPress={() => press(a)}
                  />
                  {a.disabled ? (
                    <View style={{ alignItems: 'center', marginTop: space.xs }}>
                      {a.hint ? <Txt v="caption" align="center">{a.hint}</Txt> : null}
                      {/* Yopiq tugma bosilmaydi — qulfni ochishga urinish alohida havola orqali */}
                      <Button variant="ghost" icon="refresh-cw" title="Qayta tekshirish" full={false} onPress={() => void recheck()} />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
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
