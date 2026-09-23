import React from 'react';
import { View } from 'react-native';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/ui';
import { erpText, skins } from '@/design/tokens';
import { Appear, PressScale, stagger } from '@/design/motion';
import { useSession } from '@/core/session';
import { authApi } from '@/features/auth/api';
import { AuthScreen, D, GhostButton, InfoCard } from '@/features/auth/ui';

/**
 * Korxona va rol tanlash — bir nechta a'zolik bo'lsa yoki tasdiq kutilayotgan bo'lsa.
 * Har karta o'z rolining rangi bilan: qaysi "olam"ga kirishi oldindan ko'rinadi.
 */
export default function SelectRole() {
  const { user, selectMembership, signOut, setUser } = useSession();
  const list = user?.memberships ?? [];
  const active = list.filter((m) => m.isActive);
  const pending = list.filter((m) => !m.isActive);

  return (
    <AuthScreen back={false}>
      <Appear delay={40} style={{ marginTop: 18 }}>
        <Txt style={{ ...erpText.eyebrow, color: D.accent }}>{active.length ? `${active.length} TA HISOB` : 'TASDIQ KUTILMOQDA'}</Txt>
        <Txt style={{ fontFamily: erpText.title.fontFamily, fontSize: 29, letterSpacing: -0.6, color: D.text, marginTop: 4 }}>
          {active.length ? 'Korxonani tanlang' : 'Tasdiq kutilmoqda'}
        </Txt>
        <Txt style={{ fontSize: 13.5, color: D.muted, marginTop: 8 }}>{user?.fullName ?? user?.phone}</Txt>
      </Appear>

      <View style={{ marginTop: 24, gap: 10 }}>
        {active.map((m, i) => {
          const sk = skins[m.role];
          const ink = sk.dark.brandPrimary;
          return (
            <Appear key={`${m.organization.id}:${m.role}`} delay={stagger(i, 60)}>
              <PressScale onPress={() => selectMembership(m)} haptic={false}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border, borderRadius: 15, padding: 14, minHeight: 76 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: ink + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Txt style={{ fontFamily: erpText.title.fontFamily, fontSize: 15, color: ink }}>{sk.name.slice(0, 2).toUpperCase()}</Txt>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt style={{ ...erpText.rowTitle, fontSize: 15, color: D.text }}>{sk.name}</Txt>
                    <Txt style={{ ...erpText.meta, fontSize: 11.5, color: D.muted, marginTop: 3 }} numberOfLines={1}>{m.organization.name}</Txt>
                  </View>
                  <Icon name="chevron-forward" size={18} color={D.faint} />
                </View>
              </PressScale>
            </Appear>
          );
        })}

        {pending.map((m, i) => (
          <Appear key={`p:${m.organization.id}:${m.role}`} delay={stagger(active.length + i, 60)}>
            <View style={{ backgroundColor: D.surface, borderWidth: 1, borderColor: '#5C4A28', borderRadius: 15, padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <Icon name="time-outline" size={17} color={D.accent} />
                <Txt style={{ ...erpText.rowTitle, color: D.text, flex: 1 }}>{skins[m.role].name} · {m.organization.name}</Txt>
              </View>
              <Txt style={{ fontSize: 12, lineHeight: 18, color: D.muted, marginTop: 8 }}>
                Tashkilot tadbirkori tasdiqlashini kuting — tasdiqlangach shu yerda ochiladi.
              </Txt>
            </View>
          </Appear>
        ))}

        {list.length === 0 ? (
          <Appear delay={60}>
            <InfoCard icon="person-add-outline">
              Sizga hali rol biriktirilmagan. Tadbirkor sizni telefon raqamingiz orqali qo&apos;shishi kerak.
            </InfoCard>
          </Appear>
        ) : null}
      </View>

      <Appear delay={240} style={{ marginTop: 'auto', paddingTop: 24, gap: 10 }}>
        <GhostButton title="Yangilash" icon="refresh-outline" onPress={() => authApi.me().then(setUser).catch(() => {})} />
        <GhostButton title="Chiqish" icon="log-out-outline" onPress={() => void signOut()} />
      </Appear>
    </AuthScreen>
  );
}
