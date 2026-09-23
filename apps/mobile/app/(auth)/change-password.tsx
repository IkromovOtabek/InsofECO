import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@/design/ui';
import { Appear } from '@/design/motion';
import { authApi } from '@/features/auth/api';
import { erpAuth } from '@/core/erp';
import { useSession } from '@/core/session';
import { ApiException } from '@/core/api';
import { AuthScreen, D, DarkField, ErrorBox, FieldError, InfoCard, Label, PrimaryButton, Requirements, Strength, Title, strengthOf } from '@/features/auth/ui';

/**
 * Tizimga kirgan holda parolni almashtirish (Profil → Xavfsizlik).
 *
 * ECO hisobi uchun `/v1/auth/password/change` chaqiriladi va boshqa qurilmalardagi
 * seanslar yopiladi. ERP xodimi paroli ERP tomonida turadi — u yerda hali
 * o'zgartirish endpointi yo'q, shuning uchun xodimga qayerga murojaat qilish yoziladi.
 */
export default function ChangePassword() {
  const router = useRouter();
  const kind = useSession((s) => s.kind);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ current?: string; next?: string; again?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  if (kind === 'erp') {
    return (
      <AuthScreen>
        <Title hint="Insof ERP xodimi hisobi kompyuterdagi ERP orqali boshqariladi.">Parolni o&apos;zgartirish</Title>
        <Appear delay={130} style={{ marginTop: 24 }}>
          <InfoCard icon="information-circle-outline">
            Xodim parolini hozircha ERP ma&apos;muri o&apos;zgartiradi (Sozlamalar → Xodimlar). Ilovadan almashtirish keyingi bosqichda qo&apos;shiladi.
          </InfoCard>
        </Appear>
        <Appear delay={180} style={{ marginTop: 20 }}>
          <PrimaryButton title="Tushunarli" icon={null} onPress={() => router.back()} />
        </Appear>
      </AuthScreen>
    );
  }

  const submit = async () => {
    const e: typeof error = {};
    if (current.length < 6) e.current = 'Joriy parolni kiriting';
    if (next.length < 6) e.next = 'Yangi parol kamida 6 belgi';
    else if (strengthOf(next) < 2) e.next = 'Parol juda oddiy — harf va raqam aralashtiring';
    if (next !== again) e.again = 'Parollar mos kelmadi';
    setError(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      await authApi.changePassword(current, next);
      Alert.alert('Saqlandi', 'Parol o\'zgartirildi. Boshqa qurilmalardagi seanslar yopildi.', [
        { text: 'Yopish', onPress: () => router.back() },
      ]);
    } catch (err) {
      setError({ form: err instanceof ApiException ? err.message : 'Tarmoq xatosi. Internetni tekshiring' });
    } finally { setLoading(false); }
  };
  void erpAuth;

  return (
    <AuthScreen>
      <Title hint="Joriy parolni tasdiqlang va yangisini kiriting.">Parolni o&apos;zgartirish</Title>

      <Appear delay={130} style={{ marginTop: 24 }}>
        <Label>Joriy parol</Label>
        <DarkField value={current} onChangeText={(v) => { setCurrent(v); setError((e) => ({ ...e, current: undefined })); }} secureTextEntry autoComplete="current-password" placeholder="••••••••" mono error={error.current} autoFocus />
        <FieldError text={error.current} />
      </Appear>

      <Appear delay={170} style={{ marginTop: 16 }}>
        <Label>Yangi parol</Label>
        <View style={{ justifyContent: 'center' }}>
          <DarkField value={next} onChangeText={(v) => { setNext(v); setError((e) => ({ ...e, next: undefined })); }} secureTextEntry={!show} autoComplete="new-password" placeholder="••••••••" mono focus error={error.next} style={{ paddingRight: 54 }} />
          <Pressable onPress={() => setShow((v) => !v)} accessibilityLabel={show ? 'Yashirish' : "Ko'rsatish"} style={{ position: 'absolute', right: 3, width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={19} color={D.muted} />
          </Pressable>
        </View>
        <FieldError text={error.next} />
        <Strength password={next} />
      </Appear>

      <Appear delay={210} style={{ marginTop: 16 }}>
        <Label>Yangi parolni takrorlang</Label>
        <DarkField value={again} onChangeText={(v) => { setAgain(v); setError((e) => ({ ...e, again: undefined })); }} secureTextEntry={!show} autoComplete="new-password" placeholder="••••••••" mono error={error.again} onSubmitEditing={submit} returnKeyType="go" />
        <FieldError text={error.again} />
      </Appear>

      <Appear delay={250} style={{ marginTop: 18 }}>
        <Requirements password={next} />
      </Appear>

      <ErrorBox text={error.form} />

      <Appear delay={290} style={{ marginTop: 18 }}>
        <PrimaryButton title={loading ? 'Saqlanmoqda…' : 'Parolni saqlash'} icon={null} onPress={submit} loading={loading} />
      </Appear>
    </AuthScreen>
  );
}
