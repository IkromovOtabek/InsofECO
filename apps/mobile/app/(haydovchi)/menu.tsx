import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Gap, Txt, fmtSum } from '@/design/primitives';
import { Avatar, Icon, IconName, ProgressBar } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { useSession } from '@/core/session';
import { useConversations, useHaydovchiDashboard } from '@/features/eco/api';
import { authApi } from '@/features/auth/api';

/** "Men": katta qatorlar — Transport, Daromad, Tarix, Xabarlar, Profil, Chiqish. */
export default function HaydovchiMenu() {
  const router = useRouter();
  const { c } = useTheme();
  const { user, active, signOut } = useSession();
  const conv = useConversations(); const d = useHaydovchiDashboard();
  const unread = (conv.data ?? []).reduce((s, x) => s + x.unread, 0);
  const v = d.data?.vehicle;
  const Item = ({ icon, title, sub, badge, onPress, tone = 'brand' }: { icon: IconName; title: string; sub?: string; badge?: number; onPress: () => void; tone?: 'brand' | 'info' | 'success' | 'danger' }) => {
    const col = { brand: c.brandPrimary, info: c.info, success: c.success, danger: c.danger }[tone];
    return (
      <Pressable onPress={onPress} android_ripple={{ color: c.border }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, minHeight: 72 }, pressed && { opacity: 0.6 }]}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: col + '1A', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={26} color={col} /></View>
        <View style={{ flex: 1, marginLeft: 14 }}><Txt style={{ fontSize: 19, fontWeight: '700', color: c.textPrimary }}>{title}</Txt>{sub ? <Txt v="callout" color="secondary">{sub}</Txt> : null}</View>
        {badge ? <View style={{ backgroundColor: c.danger, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3, marginRight: 8 }}><Txt style={{ color: '#fff', fontWeight: '800' }}>{badge}</Txt></View> : null}
        <Icon name="chevron-forward" size={22} />
      </Pressable>
    );
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}>
        <Avatar name={user?.fullName} size={60} tone="info" />
        <View style={{ marginLeft: 14, flex: 1 }}><Txt style={{ fontSize: 21, fontWeight: '800', color: c.textPrimary }}>{user?.fullName}</Txt><Txt v="callout" color="secondary">{active?.organization.name}</Txt></View>
      </Card>
      {v ? (
        <Pressable onPress={() => router.push('/(haydovchi)/transport')} style={{ marginTop: 12 }}>
          <Card style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}><Icon name="bus" size={30} color={c.brandPrimary} /><View style={{ marginLeft: 12, flex: 1 }}><Txt style={{ fontSize: 19, fontWeight: '800', color: c.textPrimary }}>{v.brand} · {v.plateNumber}</Txt><Txt v="callout" color="secondary">Yoqilg'i {v.fuelPercent ?? '—'}%</Txt></View></View>
            <Gap h={10} /><ProgressBar value={v.fuelPercent ?? 0} tone={(v.fuelPercent ?? 0) < 25 ? 'danger' : 'info'} height={8} />
          </Card>
        </Pressable>
      ) : null}
      <Gap h={12} />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Item icon="cash" tone="success" title="Daromadim" sub={d.data ? `Bu oy ${fmtSum(d.data.earnings.month)}` : undefined} onPress={() => router.push('/(haydovchi)/earnings')} />
        <View style={{ height: 0.5, backgroundColor: c.border, marginLeft: 78 }} />
        <Item icon="time" title="Tarix" sub="Yetkazib berishlar" onPress={() => router.push('/(haydovchi)/history')} />
        <View style={{ height: 0.5, backgroundColor: c.border, marginLeft: 78 }} />
        <Item icon="chatbubbles" tone="info" title="Xabarlar" badge={unread} onPress={() => router.push('/(haydovchi)/messages')} />
        <View style={{ height: 0.5, backgroundColor: c.border, marginLeft: 78 }} />
        <Item icon="person-circle" title="Profil" onPress={() => router.push('/(haydovchi)/profile')} />
      </Card>
      <Gap h={20} />
      <Pressable onPress={() => { void authApi.logout().catch(() => {}); void signOut(); }} style={{ height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.danger + '14' }}><Txt style={{ fontSize: 18, fontWeight: '700', color: c.danger }}>Chiqish</Txt></Pressable>
    </ScrollView>
  );
}
