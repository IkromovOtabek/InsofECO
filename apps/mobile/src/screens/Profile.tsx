import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Gap, ListItem, Screen, Txt } from '@/design/primitives';
import { Avatar, Confirm, toast } from '@/design/ui';
import { size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { authApi, avatarUri } from '@/features/auth/api';

const ROLE = { TADBIRKOR: 'Tadbirkor', QURUVCHI: 'Quruvchi', HAYDOVCHI: 'Haydovchi' } as const;

export function Profile({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const { user, active, selectMembership, setUser, signOut } = useSession();
  const memberships = user?.memberships.filter((m) => m.isActive) ?? [];
  // Hisobni o'chirish (App Store / Google Play talabi). Mijoz darhol o'chadi; zavod haydovchisi
  // so'rov qoldiradi — direktor ERP'da tasdiqlagach hisob anonimlashadi.
  const isDriver = memberships.some((m) => m.role === 'HAYDOVCHI');
  const requested = !!user?.deleteRequestedAt;
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  const deleteAccount = async () => {
    setBusy(true);
    try {
      const r = await authApi.deleteAccount();
      setAsk(false);
      if (r.status === 'deleted') {
        toast.success("Hisobingiz o'chirildi");
        await signOut();
      } else {
        if (user) setUser({ ...user, deleteRequestedAt: new Date().toISOString() });
        toast.info("So'rov zavod direktoriga yuborildi. Tasdiqlangach hisob o'chiriladi.", "So'rov qabul qilindi");
      }
    } catch (e) {
      toast.error((e as Error).message, 'Xato');
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async () => {
    try {
      await authApi.cancelDeletion();
      if (user) setUser({ ...user, deleteRequestedAt: null });
      toast.success("So'rov qaytarib olindi");
    } catch (e) {
      toast.error((e as Error).message, 'Xato');
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: space.pageX }}>
        <Card style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <Avatar name={user?.fullName} uri={avatarUri(user?.avatarUrl)} size={size.avatarLg + space.lg} />
          <Gap h={space.md} />
          <Txt v="titleMd">{user?.fullName ?? user?.phone}</Txt>
          <Txt v="body" color="muted">{active ? `${ROLE[active.role]} · ${active.organization.name}` : ''}</Txt>
          <Txt v="caption" mono style={{ marginTop: space.xs }}>{user?.phone}</Txt>
        </Card>
        {children}
        {memberships.length > 1 ? (
          <>
            <Gap />
            <Card style={{ paddingVertical: space.xs }}>
              {memberships.map((m, i, arr) => <ListItem key={`${m.organization.id}:${m.role}`} icon="arrow-left-right" title={ROLE[m.role]} subtitle={m.organization.name} onPress={() => { selectMembership(m); router.replace('/'); }} last={i === arr.length - 1} />)}
            </Card>
          </>
        ) : null}
        <Gap />
        <Card style={{ paddingVertical: space.xs }}>
          <ListItem icon="settings" title="Sozlamalar" subtitle="Mavzu, palitra, bildirishnomalar" onPress={() => router.push('/settings')} />
          <ListItem icon="languages" title="Til" subtitle="O'zbek (lotin)" onPress={() => router.push('/settings')} />
          <ListItem icon="shield-check" title="Xavfsizlik" subtitle="PIN kod va parol" onPress={() => router.push('/settings')} last />
        </Card>
        <Gap />
        <Card style={{ paddingVertical: space.xs }}>
          {requested ? (
            <ListItem
              icon="hourglass" tone="warning"
              title="Hisobni o'chirish so'ralgan"
              subtitle="Direktor tasdig'i kutilmoqda. Fikringiz o'zgarsa — bosing"
              onPress={() => void cancelRequest()}
              last
            />
          ) : (
            <ListItem
              icon="user-x" tone="danger"
              title="Hisobni o'chirish"
              subtitle={isDriver ? "So'rov zavod direktoriga boradi" : "Shaxsiy ma'lumotlar butunlay o'chiriladi"}
              onPress={() => setAsk(true)}
              last
            />
          )}
        </Card>
        <Gap h={space.xl} />
        <Button title="Chiqish" variant="danger" icon="log-out" onPress={() => { void authApi.logout().catch(() => {}); void signOut(); }} />
        <Gap h={space.xxxl} />
      </ScrollView>
      <Confirm
        open={ask}
        onClose={() => setAsk(false)}
        onConfirm={() => void deleteAccount()}
        danger
        loading={busy}
        title="Hisobni o'chirish"
        confirmLabel={isDriver ? "So'rov yuborish" : "Ha, o'chirish"}
        message={isDriver
          ? "Siz zavod haydovchisisiz — hisobni direktor tasdiqlagach o'chiramiz. Shu vaqtgacha ilova ishlayveradi."
          : "Telefon raqamingiz, ismingiz va kirish ma'lumotlaringiz butunlay o'chiriladi. Buyurtma tarixi shaxsga bog'lanmagan holda qoladi. Qaytarib bo'lmaydi."}
      />
    </Screen>
  );
}
