import { create } from 'zustand';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { Button, IconButton, IconTile, Txt } from '@/design/primitives';
import { IconName, Modal } from '@/design/ui';
import { radius, size, space } from '@/design/tokens';
import { Appear, stagger } from '@/design/motion';
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
/** Asosiy sahifa sarlavhasidagi ikonka shu oynani ochadi. */
const useLoginPromptStore = create<{ open: boolean; set: (v: boolean) => void }>((set) => ({ open: false, set: (open) => set({ open }) }));
export const openLoginPrompt = () => useLoginPromptStore.getState().set(true);

export function LoginPrompt() {
  const router = useRouter();
  const status = useSession((s) => s.status);
  const segments = useSegments() as unknown as string[];
  const inShop = segments[0] === '(shop)';
  const open = useLoginPromptStore((s) => s.open);
  const setOpen = useLoginPromptStore((s) => s.set);

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
        <IconTile icon="user" module="brand" size={size.avatarLg} />
        <View style={{ flex: 1, gap: space.xs, paddingTop: space.xs }}>
          <Txt v="titleMd">Hisobingizga kiring</Txt>
          <Txt v="bodySm" color="muted">Mahsulotlarni ko'rishni hisobsiz ham davom ettirishingiz mumkin.</Txt>
        </View>
        <IconButton icon="x" label="Yopish" onPress={close} />
      </View>

      <View style={{ gap: space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: c.bgSubtle }}>
        {PERKS.map((p, i) => (
          <Appear key={p.icon} delay={120 + stagger(i, 60)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconTile icon={p.icon} module="brand" size={size.iconTileSm} />
            <Txt v="body" style={{ flex: 1 }}>{p.text}</Txt>
          </Appear>
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <Button title="Kirish" size="lg" iconRight="arrow-right" onPress={() => go('/(auth)/login')} />
        <Button title="Ro'yxatdan o'tish" variant="secondary" size="lg" onPress={() => go('/(auth)/register')} />
      </View>
    </Modal>
  );
}
