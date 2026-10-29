import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { IconButton, Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { radius, shadow, space } from '@/design/tokens';
import { haptic } from '@/design/motion';
import { useErpNotifications } from './api';

/**
 * Mexanik: yangi qo'shilgan / skladga kelgan avto zapchastlar (ERP `lib/avto-parts.ts`).
 * Ilova ochilganda (login'dan keyin ham) ekranning tepasidan banner tushadi; «Ko'rish» — barcha yangi kelganlar
 * ro'yxati (`/erp/list/avto-zapchast`, server ochilganda xabarlarni o'qilgan qiladi va banner yo'qoladi).
 * Manba — bildirishnomalar ro'yxatidagi o'qilmagan AVTO_PART_* xabarlari: eski ERP serverida ular yo'q — banner jim turadi.
 */
const TYPES = new Set(['AVTO_PART_NEW', 'AVTO_PART_IN']);

export function AvtoPartsBanner() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useErpNotifications();
  const [closed, setClosed] = useState<string | null>(null);
  const seen = useRef<string | null>(null);
  const open = (data?.rows ?? []).filter((n) => !n.readAt && TYPES.has(n.type));
  const sig = open.map((n) => n.id).join(',');

  useEffect(() => {
    if (!sig || seen.current === sig) return;
    if (seen.current !== null) haptic.warning();
    seen.current = sig;
  }, [sig]);

  if (!open.length || closed === sig) return null;
  const first = open[0]!;
  const go = () => {
    setClosed(sig);
    router.push('/erp/list/avto-zapchast' as never);
    // Server ro'yxat ochilganda o'qilgan qiladi — qo'ng'iroqcha raqami ham yangilansin
    setTimeout(() => void qc.invalidateQueries({ queryKey: ['erp', 'notifications'] }), 1500);
  };

  return (
    <Animated.View key={sig} entering={SlideInUp.springify().damping(16)} exiting={FadeOutUp} pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + space.sm, left: space.md, right: space.md, zIndex: 50 }}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.infoBg, borderColor: c.infoSolid, borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous', padding: space.md }, shadow.pop]}>
        <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: c.infoSolid, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="car" color={c.textOnSolid} />
          <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: radius.pill, backgroundColor: c.dangerSolid, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
            <Txt v="label" style={{ color: c.textOnSolid }}>{String(open.length)}</Txt>
          </View>
        </View>
        <Pressable onPress={go} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel="Yangi avto zapchastlar — ko'rish">
          <Txt v="bodyStrong" numberOfLines={1}>{open.length > 1 ? `Yangi avto zapchastlar — ${open.length} ta` : first.title}</Txt>
          <Txt v="bodySm" numberOfLines={2} style={{ color: c.info }}>{first.body}</Txt>
          <Txt v="label" style={{ color: c.infoSolid, marginTop: 2 }}>Ko'rish ›</Txt>
        </Pressable>
        <IconButton icon="x" label="Yopish" tone="muted" onPress={() => setClosed(sig)} />
      </View>
    </Animated.View>
  );
}
