import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Callout, EmptyState, KVList, ListGroup, ListItem, Txt } from '@/design/primitives';
import { KpiGrid, PageHeader, Reveal, SectionHead, SkeletonList, type KpiItem } from '@/design/blocks';
import { dialog, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useHeaderRaise } from '@/design/motion';
import { ApiException } from '@/core/api';
import type { ErpArendaRow } from '@/core/erp';
import { useErpAction, useErpArenda } from './api';
import { PeriodSwitch } from './data-table';
import { idSeg } from './ui';

/**
 * Sekretar — «Arenda» tabi: do'konlar ijarasi (vebdagi `/arenda` sahifasining ko'chirmasi).
 * Tepada arenda kassasi (jami · naqd · perechisleniye) va «Kirim» / «Chiqim» tugmalari, keyin oy almashtirgich,
 * pastda Excel'dagi oy varag'i — bozor bo'yicha guruhlangan, har do'konda to'lashi kerak / tushgan / qoldiq.
 *
 * Hisob serverda (`GET /api/mobile/arenda?oy=`, ERP `lib/rent.ts`); formalar — umumiy `/erp/new/<key>` ekrani
 * (`arenda-kirim`, `arenda-chiqim`, `arenda-shop`), ijarachi kartasi — `/erp/arenda-shop/<id>` (shartnoma, ijarachini
 * almashtirish, joyni bo'shatish, narx o'zgarishi, svet, shu oy hisobi). Qarzdorlar va svet varag'i — server ro'yxatlari
 * (`arenda-debtors`, `arenda-svet`). Oy hisobi ochilmagan bo'lsa «Oyni ochish» amali (`arenda.open-month`).
 */

/** Server rad etdi (eski ERP — endpoint yo'q, yoki rolga yopiq). */
const notReady = (e: unknown) => (e instanceof ApiException && (e.status === 404 || e.status === 403)) || e instanceof SyntaxError;

export function ArendaScreen({ title = 'Arenda' }: { title?: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const raise = useHeaderRaise();
  const [oy, setOy] = useState<string | undefined>(undefined);
  const { data, isLoading, refetch, isRefetching, error, isPlaceholderData } = useErpArenda(oy);
  const act = useErpAction();
  const go = (href: string) => router.push(href as never);

  const openMonth = () => {
    if (!data) return;
    dialog('Oyni ochish', `${data.monthLabel}: ijaradagi joylar uchun hisob o'tgan oy hisobidan (bo'lmasa do'kon andozasidan, rejalashtirilgan yangi narx bilan) ochiladi.`, [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Ochish', onPress: () => act.mutate({ action: 'arenda.open-month', id: data.month }, { onSuccess: (r) => toast.success(r.message), onError: (e) => toast.error(e instanceof ApiException ? e.message : 'Saqlanmadi') }) },
    ]);
  };

  const kpis: KpiItem[] | null = data
    ? [
        { label: 'Arenda kassasi', value: data.balance.total, tone: data.balance.totalNum < 0 ? 'danger' : 'success', icon: 'wallet' },
        { label: 'Naqd', value: data.balance.cash, icon: 'banknote' },
        { label: 'Perechisleniye', value: data.balance.bank, icon: 'landmark' },
      ]
    : null;

  let body: React.ReactNode;
  if (isLoading && !data) body = <SkeletonList rows={6} />;
  else if (error && !data) {
    body = (
      <Callout tone="warning" icon="cloud-off">
        <View style={{ gap: space.sm }}>
          <Txt v="bodySm" color="warning">
            {notReady(error)
              ? 'Arenda bo\'limi hali ochilmadi — ERP serveri yangilanishi kerak yoki sizga ruxsat berilmagan.'
              : "Ma'lumot yuklanmadi. Internetni tekshirib, qayta urinib ko'ring."}
          </Txt>
          <Button size="md" variant="secondary" full={false} icon="refresh-cw" title="Qayta urinish" onPress={() => void refetch()} />
        </View>
      </Callout>
    );
  } else if (data) {
    const t = data.totals;
    body = (
      <Reveal replay={data.month} style={isPlaceholderData ? { opacity: 0.6 } : undefined}>
        <PeriodSwitch
          key="month"
          title={data.monthLabel}
          sub={data.opened ? `Kerak ${t.due} · tushdi ${t.paid}` : 'Oy hisobi hali ochilmagan'}
          onPrev={() => setOy(data.prev)}
          onNext={() => setOy(data.next)}
        />
        {data.month !== data.current ? (
          <Button key="now" size="md" variant="ghost" full={false} icon="calendar-days" title="Joriy oyga qaytish" onPress={() => setOy(undefined)} />
        ) : null}
        <KVList
          key="totals"
          rows={[
            { label: "To'lashi kerak", value: t.due },
            { label: 'Tushgan', value: t.paid, tone: 'success' },
            { label: 'Qoldiq', value: t.left, tone: t.leftNum > 0.005 ? 'danger' : 'success' },
          ]}
        />
        {!data.opened && data.can.shops ? (
          <Callout key="open" tone="info" icon="calendar-days">
            <View style={{ gap: space.sm }}>
              <Txt v="bodySm">Bu oy uchun do'konlar hisobi hali ochilmagan. Ochilsa ijaradagi har joy uchun «to'lashi kerak» qatori paydo bo'ladi.</Txt>
              <Button size="md" full={false} icon="plus" title="Oyni ochish" loading={act.isPending} onPress={openMonth} />
            </View>
          </Callout>
        ) : null}
        {data.groups.length === 0 ? (
          <EmptyState
            key="empty"
            icon="store"
            title={data.shops ? "Bu oyda hisob yo'q" : "Hali do'kon yo'q"}
            hint={data.shops ? 'Oyni oching yoki boshqa oyni tanlang' : "«Do'kon qo'shish» orqali birinchi do'konni kiriting"}
            action={!data.shops && data.can.shops ? "Do'kon qo'shish" : undefined}
            onAction={() => go('/erp/new/arenda-shop')}
          />
        ) : (
          data.groups.flatMap((g) => [
            <SectionHead key={`h-${g.location}`} title={g.location} count={g.rows.length} />,
            <ListGroup key={`g-${g.location}`}>
              {g.rows.map((r) => <ShopRow key={r.shopId} row={r} onPress={() => go(`/erp/arenda-shop/${idSeg(r.shopId)}`)} />)}
              <ListItem title="Umumiy" subtitle={`tushdi ${g.paid} / kerak ${g.due}`} value={g.left} tone="brand" chevron={false} />
            </ListGroup>,
          ])
        )}
      </Reveal>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader
        overline="Do'konlar ijarasi"
        title={title}
        raised={raise.raised}
        style={{ paddingTop: insets.top + space.sm }}
        actions={data?.can.shops ? [{ icon: 'plus', label: "Do'kon qo'shish", onPress: () => go('/erp/new/arenda-shop') }] : undefined}
      />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl * 3, gap: space.stack }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={c.brand} />}
      >
        {kpis ? <KpiGrid columns={3} items={kpis} /> : null}
        {data?.can.create ? (
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button variant="success" size="lg" icon="circle-arrow-down" title="Kirim" style={{ flex: 1 }} onPress={() => go('/erp/new/arenda-kirim')} />
            <Button variant="danger" size="lg" icon="circle-arrow-up" title="Chiqim" style={{ flex: 1 }} onPress={() => go('/erp/new/arenda-chiqim')} />
          </View>
        ) : null}
        {data ? (
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button variant="secondary" size="md" icon="user-x" title="Qarzdorlar" style={{ flex: 1 }} onPress={() => go('/erp/list/arenda-debtors')} />
            <Button variant="secondary" size="md" icon="zap" title="Svet" style={{ flex: 1 }} onPress={() => go('/erp/list/arenda-svet')} />
          </View>
        ) : null}
        {body}
      </ScrollView>
    </View>
  );
}

/** Oy varag'i qatori: do'kon, to'lashi kerak / tushgan, o'ngda qoldiq nishoni (qarz — qizil, to'liq — yashil, bo'sh joy — kulrang). */
function ShopRow({ row, onPress }: { row: ErpArendaRow; onPress: () => void }) {
  const badge = !row.isActive
    ? { text: "Bo'sh", tone: 'neutral' }
    : row.leftNum > 0.005
      ? { text: `−${row.left}`, tone: 'danger' }
      : row.leftNum < -0.005
        ? { text: `avans ${row.left.replace('-', '')}`, tone: 'info' }
        : { text: "To'liq", tone: 'success' };
  return (
    <ListItem
      title={row.name}
      subtitle={`kerak ${row.due} · tushdi ${row.paid}`}
      icon="store"
      badge={badge}
      onPress={onPress}
      right={<Badge label={badge.text} tone={badge.tone} />}
    />
  );
}
