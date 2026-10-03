import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Callout, Card, ListItem, Txt } from '@/design/primitives';
import { ListGroup, PageHeader } from '@/design/blocks';
import { Icon, type IconName } from '@/design/icons';
import { Appear, stagger } from '@/design/motion';
import { Avatar } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { avatarUri } from '@/features/auth/api';
import { useTelegramLogin } from '@/features/auth/telegram';
import { erpRoleConfig } from '@/features/erp/roles';

const ROLE_GROUP = { TADBIRKOR: '(tadbirkor)', QURUVCHI: '(quruvchi)', HAYDOVCHI: '(haydovchi)' } as const;

/** Hisob nima beradi — faqat ilovada BOR imkoniyatlar (kabinetda buyurtmalar, reyslar, hisob). */
const PERKS: { icon: IconName; text: string }[] = [
  { icon: 'package', text: 'Buyurtma berish va tarixini ko\'rish' },
  { icon: 'truck', text: 'Reyslar va yetkazish holati kabinetda' },
  { icon: 'file-text', text: 'Obyektlar, hujjatlar va hisob-kitob' },
];

/**
 * Profil — mehmon uchun foyda + Telegram (bir bosishda) yoki telefon/SMS orqali kirish;
 * kirgan foydalanuvchi uchun kabinet, sozlamalar va chiqish. Do'konning boshqa joyida
 * "Kirish" yo'q: mijoz avval mahsulotni ko'rsin, hisobni keyin ochsin.
 */
export default function ShopProfile() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { status, kind, user, active, erp, signOut } = useSession();
  const tg = useTelegramLogin();

  const goHome = () => {
    if (kind === 'erp' && erp) return router.replace(`/${erpRoleConfig(erp.role).group}` as never);
    if (kind === 'eco' && active) return router.replace(`/${ROLE_GROUP[active.role]}` as never);
    router.replace('/(auth)/select-role');
  };
  const toSettings = () => router.push('/settings' as never);

  const name = kind === 'erp' ? erp?.fullName : user?.fullName;
  const sub = kind === 'erp' ? erpRoleConfig(erp?.role ?? 'DIRECTOR').label : active ? `${active.organization.name}` : user?.phone;
  const authed = status === 'authed';

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title="Profil" style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.section }}>
        {authed ? (
          <>
            <Appear>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Avatar name={name ?? sub ?? '?'} uri={kind === 'eco' ? avatarUri(user?.avatarUrl) : null} size={size.avatarLg} tone="brand" />
                <View style={{ flex: 1 }}>
                  <Txt v="titleSm" numberOfLines={1}>{name ?? 'Foydalanuvchi'}</Txt>
                  {sub ? <Txt v="caption" numberOfLines={1}>{sub}</Txt> : null}
                </View>
              </Card>
            </Appear>
            <Appear delay={stagger(1)}>
              <ListGroup>
                <ListItem icon="layout-grid" module="brand" title="Kabinetim" subtitle="Buyurtmalar, reyslar va hisob" onPress={goHome} />
                <ListItem icon="settings" module="production" title="Sozlamalar" subtitle="Mavzu, til, xavfsizlik" onPress={toSettings} />
                <ListItem icon="phone" module="logistics" title="Aloqa" subtitle="Sotuv bo'limi va qo'ng'iroq so'rovi" onPress={() => router.navigate('/(shop)/(tabs)/aloqa' as never)} />
              </ListGroup>
            </Appear>
            <Appear delay={stagger(2)}>
              <ListGroup>
                <ListItem icon="log-out" tone="danger" title="Chiqish" chevron={false} onPress={() => void signOut()} />
              </ListGroup>
            </Appear>
          </>
        ) : (
          <>
            <Appear>
              <View style={{ backgroundColor: c.bgInverse, borderRadius: radius.card + space.xs, borderCurve: 'continuous', padding: space.xl, gap: space.md }}>
                <View style={{ width: space.x7, height: 3, borderRadius: radius.pill, backgroundColor: c.accent }} />
                <Txt v="overline" style={{ color: c.textOnInverseMuted }}>Insof hisobi</Txt>
                <Txt v="titleMd" style={{ color: c.textOnInverse }}>Buyurtmalaringizni kuzating, obyektlarni boshqaring</Txt>
                <View style={{ gap: space.sm }}>
                  {PERKS.map((p) => (
                    <View key={p.text} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <Icon name="check" size={size.iconSm} color={c.accent} strokeWidth={2.5} />
                      <Txt v="bodySm" style={{ color: c.textOnInverseMuted, flex: 1 }}>{p.text}</Txt>
                    </View>
                  ))}
                </View>
                <Button
                  title={tg.waiting ? 'Telegram kutilmoqda…' : 'Telegram orqali kirish'}
                  icon="send" size="lg"
                  loading={tg.starting}
                  onPress={() => void tg.start()}
                  style={{ marginTop: space.xs }}
                />
                <Button title="Telefon raqam va SMS bilan" variant="secondary" icon="smartphone" onPress={() => router.push('/(auth)/login')} />
              </View>
            </Appear>
            {tg.waiting ? (
              <Callout tone="info">Telegram botida raqamingizni ulashing — keyin ilovaga qayting, kirish o&apos;zi tugaydi.</Callout>
            ) : null}
            {tg.error ? <Callout tone="danger">{tg.error}</Callout> : null}

            <Appear delay={stagger(1)}>
              <ListGroup>
                <ListItem icon="user-plus" module="brand" title="Ro'yxatdan o'tish" subtitle="Yangi hisob ochish" onPress={() => router.push('/(auth)/register')} />
                <ListItem icon="settings" module="production" title="Sozlamalar" subtitle="Mavzu va til" onPress={toSettings} />
                <ListItem icon="phone" module="logistics" title="Aloqa" subtitle="Savol bo'lsa — qo'ng'iroq qilamiz" onPress={() => router.navigate('/(shop)/(tabs)/aloqa' as never)} />
              </ListGroup>
            </Appear>
          </>
        )}
      </ScrollView>
    </View>
  );
}
