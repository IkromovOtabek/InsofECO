import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, ListItem, Txt } from '@/design/primitives';
import { ListGroup, PageHeader, Reveal } from '@/design/blocks';
import { Avatar } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { avatarUri } from '@/features/auth/api';
import { useLogout } from '@/features/auth/logout';
import { erpRoleConfig } from '@/features/erp/roles';
import { useCart } from '@/features/shop/cart';

const ROLE_GROUP = { TADBIRKOR: '(tadbirkor)', QURUVCHI: '(quruvchi)', HAYDOVCHI: '(haydovchi)' } as const;


/**
 * Profil — demo CLIENT[7] (mehmon): to'q karta — hisob foydalari, "Kirish" va "Ro'yxatdan o'tish"
 * (parol yoki Telegram kodi — login ekranida); ostida Til, Yordam (Aloqa), Saralanganlar. Kirgan foydalanuvchida — kabinet, sozlamalar, chiqish.
 */
export default function ShopProfile() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { status, kind, user, active, erp } = useSession();
  const { confirm: logoutConfirm } = useLogout();
  const favs = useCart((s) => s.favs.length);

  const goHome = () => {
    if (kind === 'erp' && erp) return router.replace(`/${erpRoleConfig(erp.role).group}` as never);
    if (kind === 'eco' && active) return router.replace(`/${ROLE_GROUP[active.role]}` as never);
    router.replace('/(auth)/select-role');
  };
  const toSettings = () => router.push('/settings' as never);
  const toContact = () => router.push('/(shop)/aloqa' as never);
  const toFavs = () => router.navigate({ pathname: '/(shop)/(tabs)/katalog', params: { fav: '1', t: String(Date.now()) } } as never);

  const name = kind === 'erp' ? erp?.fullName : user?.fullName;
  const sub = kind === 'erp' ? erpRoleConfig(erp?.role ?? 'DIRECTOR').label : active ? `${active.organization.name}` : user?.phone;
  const authed = status === 'authed';

  const common = (
    <ListGroup>
      <ListItem icon="languages" module="logistics" title="Til" value="O'zbekcha" chevron onPress={toSettings} />
      <ListItem icon="circle-question-mark" module="brand" title="Yordam va savollar" subtitle="Sotuv bo'limi, qo'ng'iroq so'rovi" onPress={toContact} />
      {favs ? <ListItem icon="star" module="warehouse" title="Saralanganlar" value={`${favs} ta`} chevron onPress={toFavs} /> : null}
      <ListItem icon="settings" module="production" title="Sozlamalar" subtitle="Mavzu, rang, xabarlar" onPress={toSettings} />
    </ListGroup>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      {authed ? <PageHeader title="Profil" style={{ paddingTop: insets.top + space.sm }} /> : null}
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: authed ? space.sm : insets.top + space.xxl, paddingBottom: space.xxl }}>
        {authed ? (
          <Reveal gap={space.lg}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Avatar name={name ?? sub ?? '?'} uri={kind === 'eco' ? avatarUri(user?.avatarUrl) : null} size={size.avatarLg} tone="brand" />
              <View style={{ flex: 1 }}>
                <Txt v="titleSm" numberOfLines={1}>{name ?? 'Foydalanuvchi'}</Txt>
                {sub ? <Txt v="tSm" numberOfLines={1}>{sub}</Txt> : null}
              </View>
            </Card>
            <ListGroup>
              <ListItem icon="layout-grid" module="brand" title="Kabinetim" subtitle="Buyurtmalar, reyslar va hisob" onPress={goHome} />
              <ListItem icon="truck" module="logistics" title="Buyurtmalarim" subtitle="Yuborilgan arizalar va reyslar" onPress={() => router.navigate('/(shop)/(tabs)/buyurtma' as never)} />
            </ListGroup>
            {common}
            <ListGroup>
              <ListItem icon="log-out" tone="danger" title="Chiqish" chevron={false} onPress={logoutConfirm} />
            </ListGroup>
          </Reveal>
        ) : (
          <Reveal gap={space.lg}>
            {/* Mehmon: Kirish — login sahifasi (uning ostida Ro'yxatdan o'tish va Parolni unutdingizmi?) */}
            <ListGroup>
              <ListItem icon="log-in" module="brand" title="Kirish" subtitle="Hisobingizga kiring yoki ro'yxatdan o'ting" onPress={() => router.push('/(auth)/login')} chevron last />
            </ListGroup>
            {common}
          </Reveal>
        )}
      </ScrollView>
    </View>
  );
}
