import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { Button, IconButton, Txt } from '@/design/primitives';
import { Icon, IconName, Modal } from '@/design/ui';
import { radius, size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { useSession } from '@/core/session';

/** Do'kon ochilgandan shuncha vaqt o'tgach mehmonga kirish taklif qilinadi. */
const DELAY_MS = 10_000;
/** Bitta ishga tushirishda bir marta — har ekranga qaytganda qayta chiqmaydi. */
let shownThisLaunch = false;

const PERKS: { icon: IconName; text: string }[] = [
  { icon: 'package', text: 'Buyurtmalaringizni kuzatasiz' },
  { icon: 'truck', text: 'Mikser qayerdaligini xaritada ko\'rasiz' },
  { icon: 'tag', text: 'Narxlar tarixi saqlanadi' },
];

/**
 * "Kirish yoki ro'yxatdan o'ting" oynasi — faqat mehmon (sessiya yo'q) va faqat do'kon
 * ekranida turganda. Foydalanuvchi kirish ekraniga o'tib ketgan bo'lsa taymer to'xtaydi
 * va do'konga qaytganda qaytadan sanaydi — oyna kirish ekrani ostida yashirin ochilib qolmaydi.
 */
export function LoginPrompt() {
  const router = useRouter();
  const status = useSession((s) => s.status);
  const segments = useSegments() as unknown as string[];
  const inShop = segments[0] === '(shop)';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status !== 'anon' || !inShop || shownThisLaunch) return;
    const t = setTimeout(() => { shownThisLaunch = true; setOpen(true); }, DELAY_MS);
    return () => clearTimeout(t);
  }, [status, inShop]);

  // Kirib bo'lgan bo'lsa oyna kerak emas
  useEffect(() => { if (status === 'authed') setOpen(false); }, [status]);

  const go = (path: '/(auth)/login' | '/(auth)/register') => { setOpen(false); router.push(path); };

  const { c } = useTheme();
  const close = () => setOpen(false);

  return (
    <Modal open={open} onClose={close}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <View style={{ width: size.iconTile + space.sm, height: size.iconTile + space.sm, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="user" size={size.iconLg} color={c.brandInk} />
        </View>
        <View style={{ flex: 1, gap: space.xs, paddingTop: space.xs }}>
          <Txt v="titleMd">Hisobingizga kiring</Txt>
          <Txt v="bodySm" color="muted">Mahsulotlarni ko'rishni hisobsiz ham davom ettirishingiz mumkin.</Txt>
        </View>
        <IconButton icon="x" label="Yopish" onPress={close} />
      </View>

      <View style={{ gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.card, backgroundColor: c.bgSubtle }}>
        {PERKS.map((p) => (
          <View key={p.icon} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Icon name={p.icon} size={size.iconMd} color={c.brandInk} />
            <Txt v="body" style={{ flex: 1 }}>{p.text}</Txt>
          </View>
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <Button title="Kirish" size="lg" iconRight="arrow-right" onPress={() => go('/(auth)/login')} />
        <Button title="Ro'yxatdan o'tish" variant="secondary" size="lg" onPress={() => go('/(auth)/register')} />
      </View>
    </Modal>
  );
}
