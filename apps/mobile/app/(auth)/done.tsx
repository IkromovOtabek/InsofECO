import React from 'react';
import { useRouter } from 'expo-router';
import { KVList, Txt } from '@/design/primitives';
import { size, space } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { SuccessCheck } from '@/design/success';
import { useSession } from '@/core/session';
import { AuthScreen, GhostButton, InfoCard, PrimaryButton, Steps } from '@/features/auth/ui';

/** Ro'yxatdan o'tish yoki parol tiklash tugagach — xulosa va keyingi qadam. */
export default function Done() {
  const router = useRouter();
  const { user, erp, kind } = useSession();
  const name = kind === 'erp' ? erp?.fullName : user?.fullName;
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Foydalanuvchi', value: name ?? '—' },
    ...(kind === 'erp'
      ? [{ label: 'Login', value: erp?.login ?? '—', mono: true }, { label: 'Bo\'lim', value: erp?.roleLabel ?? '—' }]
      : [{ label: 'Telefon', value: user?.phone ?? '—', mono: true }, { label: 'Rollar', value: String(user?.memberships.filter((m) => m.isActive).length ?? 0), mono: true }]),
  ];

  return (
    <AuthScreen back={false}>
      <Steps labels={["Ma'lumotlar", "Kod tasdig'i", 'Tayyor']} current={2} />

      <Appear delay={80} style={{ alignItems: 'center', marginTop: space.x10 }}>
        <SuccessCheck size={size.driverTouch * 2} />
        <Txt v="titleLg" align="center" style={{ marginTop: space.xl }}>Hammasi tayyor</Txt>
        <Txt v="bodySm" color="muted" align="center" style={{ marginTop: space.sm }}>
          Hisobingiz tasdiqlandi. Endi rolingizga tegishli bo&apos;limlar ochiq.
        </Txt>
      </Appear>

      <Appear delay={150} style={{ marginTop: space.x7 }}>
        <KVList rows={rows.map((r) => ({ label: r.label, value: r.mono ? <Txt v="mono" color="strong" numberOfLines={1} style={{ flexShrink: 1 }}>{r.value}</Txt> : r.value }))} />
      </Appear>

      <Appear delay={210} style={{ marginTop: space.lg }}>
        <InfoCard icon="shield-check" tone="brand">
          Xavfsizlik uchun PIN kodni yoqib qo&apos;yishni tavsiya qilamiz.
        </InfoCard>
      </Appear>

      <Appear delay={260} style={{ marginTop: 'auto', paddingTop: space.xl, gap: space.md }}>
        <PrimaryButton title="Tizimga kirish" onPress={() => router.replace('/')} />
        <GhostButton title="Xavfsizlikni sozlash" icon="grid-3x3" onPress={() => router.push('/(auth)/pin')} />
      </Appear>
    </AuthScreen>
  );
}
