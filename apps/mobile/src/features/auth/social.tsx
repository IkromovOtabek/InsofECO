import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Icon } from '@/design/icons';
import { size, social, space } from '@/design/tokens';

/** Telegram'ning rasmiy belgisi (doira + qog'oz samolyot), 24×24. */
const TG_PATH = 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z';

const D = size.avatarLg; // 56 — dumaloq tugma

/**
 * Kirish usullari — faqat belgi, yozuvsiz (foydalanuvchi so'rovi): Telegram o'z ko'k rangida,
 * SMS yashil (`onSms` berilmasa — masalan login allaqachon telefon rejimida — ko'rinmaydi). Ekran o'quvchi uchun `accessibilityLabel` bor.
 */
export function SocialLogin({ onTelegram, onSms, telegramBusy }: { onTelegram: () => void; onSms?: () => void; telegramBusy?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xl }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Telegram orqali kirish" onPress={onTelegram} hitSlop={8}
        style={({ pressed }) => ({ width: D, height: D, borderRadius: D / 2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
        {telegramBusy ? <ActivityIndicator color={social.telegram} /> : <Svg width={D} height={D} viewBox="0 0 24 24"><Path d={TG_PATH} fill={social.telegram} /></Svg>}
      </Pressable>
      {onSms ? <Pressable accessibilityRole="button" accessibilityLabel="SMS-kod orqali kirish" onPress={onSms} hitSlop={8}
        style={({ pressed }) => ({ width: D, height: D, borderRadius: D / 2, backgroundColor: social.sms, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
        <Icon name="message-circle" color={social.onSocial} size={size.iconXl} strokeWidth={2} />
      </Pressable> : null}
    </View>
  );
}
