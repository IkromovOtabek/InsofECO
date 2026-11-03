import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { Button, IconButton, Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { Appear } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space } from '@/design/tokens';

/** Ilova fonda turib qaytganda yangi OTA'ni shu oraliqdan tez-tez so'ramaydi. */
const CHECK_EVERY_MS = 10 * 60_000;

/**
 * "Yangi versiya tayyor" — OTA fonda yuklab bo'lingach (`isUpdatePending`) tepada chiqadigan karta.
 * Busiz yangilanish faqat ilova to'liq yopib ochilganda ishlardi va xodimlar uni sezmasdi.
 * Ochilishdagi tekshiruvni expo-updates o'zi qiladi; bu yerda — ilova fondan qaytganda ham.
 * "Yangilash" — `reloadAsync` (sessiya va navbatdagi amallar saqlanadi). Yopilsa — shu ishga tushishda boshqa chiqmaydi.
 */
export function AppReloadBanner() {
  const { isUpdatePending } = Updates.useUpdates();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    let last = Date.now();
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || Date.now() - last < CHECK_EVERY_MS) return;
      last = Date.now();
      void Updates.checkForUpdateAsync()
        .then((r) => (r.isAvailable ? Updates.fetchUpdateAsync() : null))
        .catch(() => {});
    });
    return () => sub.remove();
  }, []);

  if (!isUpdatePending || hidden) return null;
  const reload = () => { setBusy(true); void Updates.reloadAsync().catch(() => setBusy(false)); };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg }}>
      <Appear from={-8} scale={1}>
        <View accessibilityLiveRegion="polite" style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, paddingRight: space.xs }, shadow.pop]}>
          <Icon name="download" size={size.iconMd} color={c.brand} />
          <View style={{ flex: 1 }}>
            <Txt v="bodyStrong" numberOfLines={1}>Yangi versiya tayyor</Txt>
            <Txt v="caption" color="muted" numberOfLines={2}>Bir necha soniyada qayta ochiladi</Txt>
          </View>
          <Button size="md" full={false} title="Yangilash" loading={busy} onPress={reload} />
          <IconButton icon="x" label="Keyinroq" onPress={() => setHidden(true)} tone="muted" size={size.touch - space.sm} />
        </View>
      </Appear>
    </View>
  );
}
