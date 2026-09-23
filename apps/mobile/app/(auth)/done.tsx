import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/ui';
import { erpText } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { useSession } from '@/core/session';
import { AuthScreen, D, GhostButton, InfoCard, PrimaryButton, Steps } from '@/features/auth/ui';

/** Ro'yxatdan o'tish yoki parol tiklash tugagach — xulosa va keyingi qadam. */
export default function Done() {
  const router = useRouter();
  const { user, erp, kind } = useSession();
  const name = kind === 'erp' ? erp?.fullName : user?.fullName;
  const rows: { label: string; value: string }[] = [
    { label: 'Foydalanuvchi', value: name ?? '—' },
    ...(kind === 'erp'
      ? [{ label: 'Login', value: erp?.login ?? '—' }, { label: 'Bo\'lim', value: erp?.roleLabel ?? '—' }]
      : [{ label: 'Telefon', value: user?.phone ?? '—' }, { label: 'Rollar', value: String(user?.memberships.filter((m) => m.isActive).length ?? 0) }]),
  ];

  return (
    <AuthScreen back={false}>
      <Steps labels={["Ma'lumotlar", 'SMS tasdiq', 'Tayyor']} current={2} />

      <Appear delay={80} style={{ alignItems: 'center', marginTop: 44 }}>
        <View style={{ width: 84, height: 84, borderRadius: 99, backgroundColor: D.okBg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="checkmark" size={40} color={D.okSoft} />
        </View>
        <Txt style={{ fontFamily: erpText.title.fontFamily, fontSize: 29, letterSpacing: -0.6, color: D.text, marginTop: 22 }}>Hammasi tayyor</Txt>
        <Txt style={{ fontSize: 13.5, lineHeight: 21, color: D.muted, marginTop: 8, textAlign: 'center' }}>
          Hisobingiz tasdiqlandi. Endi rolingizga tegishli bo&apos;limlar ochiq.
        </Txt>
      </Appear>

      <Appear delay={150} style={{ marginTop: 28 }}>
        <View style={{ backgroundColor: D.surface, borderWidth: 1, borderColor: D.border, borderRadius: 16, paddingHorizontal: 16 }}>
          {rows.map((r, i) => (
            <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 13, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: D.border }}>
              <Txt style={{ fontSize: 12.5, color: D.muted }}>{r.label}</Txt>
              <Txt style={{ ...erpText.meta, fontSize: 13, color: D.text, flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>{r.value}</Txt>
            </View>
          ))}
        </View>
      </Appear>

      <Appear delay={210} style={{ marginTop: 16 }}>
        <InfoCard icon="shield-checkmark-outline" color={D.accent}>
          Xavfsizlik uchun PIN kodni yoqib qo&apos;yishni tavsiya qilamiz.
        </InfoCard>
      </Appear>

      <Appear delay={260} style={{ marginTop: 'auto', paddingTop: 22, gap: 10 }}>
        <PrimaryButton title="Tizimga kirish" onPress={() => router.replace('/')} />
        <GhostButton title="Xavfsizlikni sozlash" icon="keypad-outline" onPress={() => router.push('/(auth)/pin')} />
      </Appear>
    </AuthScreen>
  );
}
