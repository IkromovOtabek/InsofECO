import React from 'react';
import { BackHandler, Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Txt } from '@/design/primitives';
import { toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { Appear } from '@/design/motion';
import { AuthLogo } from '@/features/auth/ui';
import { APP_VERSION, useAppUpdate } from '@/core/app-update';
import { config } from '@/core/config';

/**
 * "Ilovani yangilang" — server 426 / `APP_UPDATE_REQUIRED` qaytarganda hamma narsaning ustida
 * turadigan to'liq ekran. Yopib bo'lmaydi (Android "orqaga" ham yopmaydi): eski ilova bilan
 * davom etish ma'lumotni buzishi mumkin. Sessiya o'chirilmaydi — yangilangach o'sha hisob ochiladi.
 */
export function UpdateRequired() {
  const info = useAppUpdate((s) => s.required);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (!info) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [info]);

  if (!info) return null;
  const open = (url: string) => { void Linking.openURL(url).catch(() => toast.error("Havola ochilmadi — do'kondan «Insof ECO» ni qidiring")); };

  return (
    <View
      accessibilityViewIsModal
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: c.bgApp, paddingTop: insets.top, paddingBottom: insets.bottom + space.lg }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: space.pageX, gap: space.lg }}>
        <AuthLogo />
        <Appear delay={80} style={{ gap: space.sm }}>
          <Txt v="titleLg" align="center" accessibilityRole="header">Ilovani yangilang</Txt>
          <Txt v="body" color="muted" align="center">{info.message}</Txt>
          <Txt v="caption" color="faint" align="center">{`Joriy versiya: ${APP_VERSION}`}</Txt>
        </Appear>
        <Appear delay={140} style={{ gap: space.md, marginTop: space.md }}>
          {info.url ? <Button title="Yangilash" icon="download" size="lg" onPress={() => open(info.url!)} /> : null}
          {config.supportTelegram ? <Button title="Telegram orqali yordam" icon="send" variant="secondary" size="lg" onPress={() => open(config.supportTelegram!)} /> : null}
        </Appear>
      </ScrollView>
    </View>
  );
}
