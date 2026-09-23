import React from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Gap, Screen, StatusChip, Txt, fmtSum } from '@/design/primitives';
import { Icon, Kpi, Row, Section, Stars, fmtShort } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useQuruvchiDashboard } from '@/features/eco/api';
import { useSession } from '@/core/session';

/** Bosh ekrandagi ikki katta amal plitkasi: terrakota (asosiy) va sirt (ikkilamchi). */
function ActionTile({ title, hint, icon, primary, onPress }: { title: string; hint: string; icon: React.ComponentProps<typeof Icon>['name']; primary?: boolean; onPress: () => void }) {
  const { c, shape } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: primary ? 1.35 : 1, minHeight: 118, padding: 16, justifyContent: 'space-between', borderRadius: shape.card, backgroundColor: primary ? c.brandPrimary : c.bgSurface, borderWidth: primary ? 0 : 1, borderColor: c.border }, pressed && { opacity: 0.85 }]}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: primary ? 'rgba(255,255,255,0.18)' : c.brandPrimarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color={primary ? c.textOnBrand : c.brandPrimary} />
      </View>
      <View>
        <Txt v="heading" style={{ color: primary ? c.textOnBrand : c.textPrimary }}>{title}</Txt>
        <Txt v="caption" style={{ color: primary ? c.textOnBrand : c.textSecondary, opacity: primary ? 0.8 : 1 }}>{hint}</Txt>
      </View>
    </Pressable>
  );
}

/**
 * Quruvchi bosh sahifasi — "Qurilish" skini: salom + reyting → asosiy amal plitkalari (Beton buyurtma · Material) →
 * KPI → ochiq buyurtmalar banneri → bugungi vazifalar → faol buyurtmalar → oy daromadi. Yumaloq, iliq.
 */
export default function QuruvchiHome() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const d = useQuruvchiDashboard();
  const x = d.data;
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={d.isFetching} onRefresh={() => void d.refetch()} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Txt v="caption" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Quruvchi</Txt>
            <Txt v="title">Salom, {(user?.fullName ?? '').split(' ')[0]} 👋</Txt>
            {x?.profile ? <Stars value={x.profile.ratingAvg} /> : null}
          </View>
          <Pressable onPress={() => router.push('/(quruvchi)/messages')} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}><Icon name="chatbubble-ellipses-outline" size={22} color={c.brandPrimary} /></Pressable>
        </View>
        <Gap h={16} />

        {/* Asosiy amal — birinchi o'rinda (dizayn hujjati: "Beton buyurtma qilish" katta tugma) */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ActionTile title="Beton buyurtma" hint="Marka · hajm · obyekt — 3 qadam" icon="cube" primary onPress={() => router.push('/(quruvchi)/new-order')} />
          <ActionTile title="Material" hint="So'rov yuborish" icon="file-tray-full" onPress={() => router.push('/(quruvchi)/new-request')} />
        </View>
        <Gap h={12} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Kpi label="Bugungi vazifalar" value={String(x?.todayTasks.length ?? 0)} icon="checkbox" tone="brand" onPress={() => router.push('/(quruvchi)/tasks')} />
          <Kpi label="Faol buyurtmalar" value={String(x?.activeOrders.length ?? 0)} icon="clipboard" onPress={() => router.push('/(quruvchi)/orders')} />
          <Kpi label="Tugallangan ishlar" value={String(x?.doneCount ?? 0)} icon="checkmark-done" tone="success" onPress={() => router.push('/(quruvchi)/my-jobs')} />
          <Kpi label="Bugungi daromad" value={fmtShort(x?.earnings.today ?? 0)} icon="cash" tone="brand" onPress={() => router.push('/(quruvchi)/earnings')} />
        </View>
        {x?.openOrders ? (
          <Pressable onPress={() => router.push('/(quruvchi)/orders')} style={{ marginTop: 16 }}>
            <Card style={{ backgroundColor: c.brandPrimary, borderColor: c.brandPrimary, flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="flash" size={26} color={c.textOnBrand} /><View style={{ marginLeft: 12, flex: 1 }}><Txt v="heading" color="onBrand">{x.openOrders} ta ochiq buyurtma</Txt><Txt v="caption" style={{ color: c.textOnBrand, opacity: 0.85 }}>Qabul qiling va ishni boshlang</Txt></View><Icon name="chevron-forward" color={c.textOnBrand} />
            </Card>
          </Pressable>
        ) : null}

        <Section title="Bugungi vazifalar" action="Barchasi" onAction={() => router.push('/(quruvchi)/tasks')}>
          {(x?.todayTasks ?? []).length === 0 ? <Txt color="secondary" style={{ padding: 12 }}>Bugunga vazifa yo'q</Txt> : null}
          {(x?.todayTasks ?? []).slice(0, 5).map((t, i, arr) => <Row key={t.id} icon={t.status === 'DONE' ? 'checkbox' : 'square-outline'} iconTone={t.priority === 'HIGH' ? 'danger' : t.priority === 'MEDIUM' ? 'warning' : 'brand'} title={t.title} subtitle={t.project?.name} right={<StatusChip status={t.status} />} onPress={() => router.push('/(quruvchi)/tasks')} last={i === arr.length - 1} />)}
        </Section>

        <Section title="Faol buyurtmalar" action="Barchasi" onAction={() => router.push('/(quruvchi)/orders')}>
          {(x?.activeOrders ?? []).length === 0 ? <Txt color="secondary" style={{ padding: 12 }}>Faol buyurtma yo'q</Txt> : null}
          {(x?.activeOrders ?? []).map((o, i, arr) => <Row key={o.id} icon="hammer" title={o.title} subtitle={`${o.project?.name ?? ''} · ${fmtSum(o.price)} · muddat ${new Date(o.deadline).toLocaleDateString('ru-RU')}`} right={<StatusChip status={o.status} />} onPress={() => router.push(`/work-order/${o.id}`)} last={i === arr.length - 1} />)}
        </Section>

        <Section title="Bu oy daromad" action="Batafsil" onAction={() => router.push('/(quruvchi)/earnings')}>
          <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
            <View style={{ flex: 1 }}><Txt v="caption" color="secondary">Jami</Txt><Txt v="subtitle">{fmtShort(x?.earnings.month ?? 0)}</Txt></View>
            <View style={{ flex: 1 }}><Txt v="caption" color="secondary">To'langan</Txt><Txt v="subtitle" color="success">{fmtShort(x?.earnings.monthPaid ?? 0)}</Txt></View>
            <View style={{ flex: 1 }}><Txt v="caption" color="secondary">Kutilmoqda</Txt><Txt v="subtitle" color="warning">{fmtShort(x?.earnings.monthPending ?? 0)}</Txt></View>
          </View>
        </Section>
      </ScrollView>
    </Screen>
  );
}
