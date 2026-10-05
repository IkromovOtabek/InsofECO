import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Callout, Card, ListItem, Txt } from '@/design/primitives';
import { ListGroup, PageHeader, Reveal } from '@/design/blocks';
import { Icon } from '@/design/icons';
import { Avatar, dialog } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { elevation, radius, size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { avatarUri } from '@/features/auth/api';
import { useTelegramLogin } from '@/features/auth/telegram';
import { erpRoleConfig } from '@/features/erp/roles';
import { InverseGrid } from '@/features/shop/art';
import { useCart } from '@/features/shop/cart';

const ROLE_GROUP = { TADBIRKOR: '(tadbirkor)', QURUVCHI: '(quruvchi)', HAYDOVCHI: '(haydovchi)' } as const;

/** Hisob nima beradi — ECO kabinetida BOR imkoniyatlar (jonli reys, hisob-kitob, obyektlar). */
const PERKS = ['Mikser jonli xaritada', 'Hisob-faktura va akt-sverka', 'Bir nechta obyekt va jamoa'];

/**
 * Profil — demo CLIENT[7] (mehmon): to'q karta — hisob foydalari, "Telegram orqali kirish", "yoki telefon raqam
 * va SMS"; ostida Til, Yordam (Aloqa), Saralanganlar. Kirgan foydalanuvchida — kabinet, sozlamalar, chiqish.
 */
export default function ShopProfile() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { status, kind, user, active, erp, signOut } = useSession();
  const favs = useCart((s) => s.favs.length);
  const tg = useTelegramLogin();

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
              <ListItem icon="log-out" tone="danger" title="Chiqish" chevron={false} onPress={() => dialog('Chiqasizmi?', 'Qayta kirish uchun login yoki telefon kodi kerak bo\'ladi.', [{ text: 'Chiqish', style: 'destructive', onPress: () => { void signOut(); } }, { text: 'Bekor', style: 'cancel' }], { tone: 'warning', icon: 'log-out' })} />
            </ListGroup>
          </Reveal>
        ) : (
          <Reveal gap={space.lg}>
            <View style={[{ borderRadius: radius.hero, borderCurve: 'continuous', backgroundColor: c.bgInverse }, elevation(c).hero]}>
              <View style={{ borderRadius: radius.hero, borderCurve: 'continuous', overflow: 'hidden', padding: space.lg + 2, gap: space.md + 2 }}>
                <InverseGrid />
                <Txt v="appbarOverline" style={{ color: c.textOnInverseMuted }}>Insof ECO hisobi</Txt>
                <Txt v="titleLg" style={{ color: c.textOnInverse }}>Buyurtmalaringizni kuzating, obyektlarni boshqaring</Txt>
                <View style={{ gap: space.sm }}>
                  {PERKS.map((p) => (
                    <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <Icon name="check" size={size.iconSm} color={c.textOnInverseMuted} strokeWidth={2} />
                      <Txt v="tSm" style={{ color: c.textOnInverseMuted, flex: 1 }}>{p}</Txt>
                    </View>
                  ))}
                </View>
                <Button
                  title={tg.waiting ? 'Telegram kutilmoqda…' : 'Telegram orqali kirish'}
                  icon="send" size="sticky" loading={tg.starting}
                  onPress={() => void tg.start()}
                  style={{ marginTop: space.xs }}
                />
                <Pressable accessibilityRole="link" onPress={() => router.push('/(auth)/login')} hitSlop={space.sm} style={({ pressed }) => ({ alignSelf: 'center', opacity: pressed ? 0.6 : 1 })}>
                  <Txt v="tSm" style={{ color: c.textOnInverseMuted }}>yoki telefon raqam va SMS</Txt>
                </Pressable>
              </View>
            </View>
            {tg.waiting ? <Callout tone="info">Telegram botida raqamingizni ulashing — keyin ilovaga qayting, kirish o&apos;zi tugaydi.</Callout> : null}
            {tg.error ? <Callout tone="danger">{tg.error}</Callout> : null}
            {common}
          </Reveal>
        )}
      </ScrollView>
    </View>
  );
}
