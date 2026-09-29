import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, ListItem, Txt } from '@/design/primitives';
import { Avatar } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { erpRoleConfig } from '@/features/erp/roles';
import { ShopHeader } from '@/features/shop/ui';

const ROLE_GROUP = { TADBIRKOR: '(tadbirkor)', QURUVCHI: '(quruvchi)', HAYDOVCHI: '(haydovchi)' } as const;

/**
 * Profil — mehmon uchun kirish/ro'yxatdan o'tish (Telegram bilan bir bosishda),
 * kirgan foydalanuvchi uchun o'z kabinetiga o'tish. Do'konning boshqa joyida
 * "Kirish" yo'q: mijoz avval mahsulotni ko'rsin, hisobni keyin ochsin.
 */
export default function ShopProfile() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { status, kind, user, active, erp, signOut } = useSession();

  const goHome = () => {
    if (kind === 'erp' && erp) return router.replace(`/${erpRoleConfig(erp.role).group}` as never);
    if (kind === 'eco' && active) return router.replace(`/${ROLE_GROUP[active.role]}` as never);
    router.replace('/(auth)/select-role');
  };

  const name = kind === 'erp' ? erp?.fullName : user?.fullName;
  const sub = kind === 'erp' ? erpRoleConfig(erp?.role ?? 'DIRECTOR').label : active ? `${active.organization.name}` : user?.phone;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ShopHeader />
      <ScrollView contentContainerStyle={{ padding: space.pageX, paddingBottom: insets.bottom + space.xxxl, gap: space.section }}>
        {status === 'authed' ? (
          <>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Avatar name={name ?? sub ?? '?'} tone="brand" />
              <View style={{ flex: 1 }}>
                <Txt v="titleSm" numberOfLines={1}>{name ?? 'Foydalanuvchi'}</Txt>
                {sub ? <Txt v="caption" numberOfLines={1}>{sub}</Txt> : null}
              </View>
            </Card>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <ListItem icon="layout-grid" module="brand" title="Kabinetim" subtitle="Buyurtmalar, reyslar va hisob" chevron onPress={goHome} />
              <ListItem icon="log-out" tone="danger" title="Chiqish" onPress={() => void signOut()} last />
            </Card>
          </>
        ) : (
          <>
            <View style={{ gap: space.sm }}>
              <Txt v="titleLg">Hisob oching</Txt>
              <Txt v="bodySm" color="muted">Buyurtmalaringizni kuzatasiz, mikser qayerdaligini xaritada ko'rasiz, narxlar tarixi saqlanadi.</Txt>
            </View>
            <View style={{ gap: space.sm }}>
              <Button title="Kirish" size="lg" iconRight="arrow-right" onPress={() => router.push('/(auth)/login')} />
              <Button title="Ro'yxatdan o'tish" variant="secondary" size="lg" icon="user-plus" onPress={() => router.push('/(auth)/register')} />
            </View>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <ListItem icon="send" module="brand" title="Telegram orqali — 10 soniyada" subtitle="Parol o'ylab topish shart emas: botda raqamni ulashasiz, tamom" chevron onPress={() => router.push('/(auth)/login')} last />
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
