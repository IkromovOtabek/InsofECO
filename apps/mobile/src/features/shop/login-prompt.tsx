import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { Button, Txt } from '@/design/primitives';
import { Modal } from '@/design/ui';
import { space } from '@/design/tokens';
import { useSession } from '@/core/session';

/** Do'kon ochilgandan shuncha vaqt o'tgach mehmonga kirish taklif qilinadi. */
const DELAY_MS = 10_000;
/** Bitta ishga tushirishda bir marta — har ekranga qaytganda qayta chiqmaydi. */
let shownThisLaunch = false;

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

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Kirish yoki ro'yxatdan o'ting">
      <Txt v="body" color="muted">
        Hisob bilan buyurtmalaringizni kuzatasiz, mikser qayerdaligini xaritada ko'rasiz va narxlar tarixini saqlaysiz.
        Mahsulotlarni ko'rishni davom ettirishingiz ham mumkin.
      </Txt>
      <View style={{ gap: space.sm }}>
        <Button title="Kirish" size="lg" iconRight="arrow-right" onPress={() => go('/(auth)/login')} />
        <Button title="Ro'yxatdan o'tish" variant="secondary" size="lg" onPress={() => go('/(auth)/register')} />
        <Button title="Keyinroq" variant="ghost" onPress={() => setOpen(false)} />
      </View>
    </Modal>
  );
}
