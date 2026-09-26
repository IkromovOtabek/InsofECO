import React from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Gap, IconButton, IconTile, KPICard, ListItem, Panel, Screen, StatusChip, Txt, fmtDateFull, fmtSum } from '@/design/primitives';
import { IconName, Stars, fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { ModuleTone, radius, shadow, size, space } from '@/design/tokens';
import { useQuruvchiDashboard } from '@/features/eco/api';
import { useSession } from '@/core/session';

const money = (v: number | string) => `${fmtShort(v)} so'm`;

/** Bosh ekrandagi ikki amal plitkasi: asosiy (brend chegara) va ikkilamchi. */
function ActionTile({ title, hint, icon, module: m, primary, onPress }: { title: string; hint: string; icon: IconName; module: ModuleTone; primary?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={title} onPress={onPress} android_ripple={{ color: c.bgMuted }}
      style={({ pressed }) => [
        { flex: primary ? 1.35 : 1, minHeight: space.x12 * 2 + space.xxl, padding: space.card, justifyContent: 'space-between', borderRadius: radius.card, backgroundColor: c.bgSurface, borderWidth: size.hairline, borderColor: primary ? c.brand : c.borderDefault },
        shadow.card, pressed && { backgroundColor: c.bgMuted },
      ]}
    >
      <IconTile icon={icon} module={m} />
      <View>
        <Txt v="titleSm">{title}</Txt>
        <Txt v="caption">{hint}</Txt>
      </View>
    </Pressable>
  );
}

/**
 * Quruvchi bosh sahifasi: salom + reyting → asosiy amal plitkalari (Beton buyurtma · Material) →
 * KPI → ochiq buyurtmalar → bugungi vazifalar → faol buyurtmalar → oy daromadi.
 */
export default function QuruvchiHome() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, active } = useSession();
  const d = useQuruvchiDashboard();
  const x = d.data;
  const grid = { flexBasis: '48%' as const, flexGrow: 1 };
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: insets.top + space.md, paddingBottom: space.xxxl }} refreshControl={<RefreshControl refreshing={d.isFetching} onRefresh={() => void d.refetch()} tintColor={c.textMuted} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Txt v="overline" numberOfLines={1}>{active?.organization.name ?? 'Quruvchi'}</Txt>
            <Txt v="titleLg" numberOfLines={1}>Salom, {(user?.fullName ?? '').split(' ')[0]}</Txt>
            {x?.profile ? <Stars value={x.profile.ratingAvg} /> : null}
          </View>
          <IconButton icon="message-circle" label="Xabarlar" variant="secondary" onPress={() => router.push('/(quruvchi)/messages')} />
        </View>
        <Gap h={space.xl} />

        {/* Asosiy amal — birinchi o'rinda (dizayn hujjati: "Beton buyurtma qilish" katta tugma) */}
        <View style={{ flexDirection: 'row', gap: space.grid }}>
          <ActionTile title="Beton buyurtma" hint="Marka · hajm · obyekt — 3 qadam" icon="package" module="brand" primary onPress={() => router.push('/(quruvchi)/new-order')} />
          <ActionTile title="Material" hint="So'rov yuborish" icon="inbox" module="warehouse" onPress={() => router.push('/(quruvchi)/new-request')} />
        </View>
        <Gap h={space.grid} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.grid }}>
          <KPICard label="Bugungi vazifalar" value={String(x?.todayTasks.length ?? 0)} icon="square-check" module="production" style={grid} onPress={() => router.push('/(quruvchi)/tasks')} />
          <KPICard label="Faol buyurtmalar" value={String(x?.activeOrders.length ?? 0)} icon="clipboard-list" style={grid} onPress={() => router.push('/(quruvchi)/orders')} />
          <KPICard label="Tugallangan ishlar" value={String(x?.doneCount ?? 0)} icon="check-check" tone="success" style={grid} onPress={() => router.push('/(quruvchi)/my-jobs')} />
          <KPICard label="Bugungi daromad" value={money(x?.earnings.today ?? 0)} icon="banknote" style={grid} onPress={() => router.push('/(quruvchi)/earnings')} />
        </View>
        {x?.openOrders ? (
          <Card style={{ marginTop: space.lg, paddingVertical: space.xs, borderColor: c.brand }}>
            <ListItem icon="zap" module="brand" title={`${x.openOrders} ta ochiq buyurtma`} subtitle="Qabul qiling va ishni boshlang" onPress={() => router.push('/(quruvchi)/orders')} last />
          </Card>
        ) : null}

        <Panel title="Bugungi vazifalar" action="Barchasi" onAction={() => router.push('/(quruvchi)/tasks')}>
          {(x?.todayTasks ?? []).length === 0 ? <Txt v="bodySm" color="muted" style={{ paddingVertical: space.md }}>Bugunga vazifa yo&apos;q</Txt> : null}
          {(x?.todayTasks ?? []).slice(0, 5).map((t, i, arr) => (
            <ListItem key={t.id} icon={t.status === 'DONE' ? 'circle-check' : 'circle'} tone={t.status === 'DONE' ? 'success' : t.priority === 'HIGH' ? 'danger' : t.priority === 'MEDIUM' ? 'warning' : 'brand'} title={t.title} subtitle={t.project?.name} right={<StatusChip status={t.status} />} onPress={() => router.push('/(quruvchi)/tasks')} last={i === arr.length - 1} />
          ))}
        </Panel>

        <Panel title="Faol buyurtmalar" action="Barchasi" onAction={() => router.push('/(quruvchi)/orders')}>
          {(x?.activeOrders ?? []).length === 0 ? <Txt v="bodySm" color="muted" style={{ paddingVertical: space.md }}>Faol buyurtma yo&apos;q</Txt> : null}
          {(x?.activeOrders ?? []).map((o, i, arr) => (
            <ListItem key={o.id} icon="hammer" module="production" title={o.title} subtitle={`${o.project?.name ?? ''} · ${fmtSum(o.price)} · muddat ${fmtDateFull(o.deadline)}`} right={<StatusChip status={o.status} />} onPress={() => router.push(`/work-order/${o.id}`)} last={i === arr.length - 1} />
          ))}
        </Panel>

        <Panel title="Bu oy daromad" action="Batafsil" onAction={() => router.push('/(quruvchi)/earnings')}>
          <View style={{ flexDirection: 'row', paddingVertical: space.sm, gap: space.sm }}>
            <View style={{ flex: 1 }}><Txt v="caption">Jami</Txt><Txt v="titleSm" numberOfLines={1} adjustsFontSizeToFit>{money(x?.earnings.month ?? 0)}</Txt></View>
            <View style={{ flex: 1 }}><Txt v="caption">To&apos;langan</Txt><Txt v="titleSm" color="success" numberOfLines={1} adjustsFontSizeToFit>{money(x?.earnings.monthPaid ?? 0)}</Txt></View>
            <View style={{ flex: 1 }}><Txt v="caption">Kutilmoqda</Txt><Txt v="titleSm" color="warning" numberOfLines={1} adjustsFontSizeToFit>{money(x?.earnings.monthPending ?? 0)}</Txt></View>
          </View>
        </Panel>
      </ScrollView>
    </Screen>
  );
}
