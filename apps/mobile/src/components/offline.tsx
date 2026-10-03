import React, { useEffect, useState } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Txt } from '@/design/primitives';
import { Icon, IconName } from '@/design/icons';
import { Appear, haptic } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { DEMO_SCALE, size, space } from '@/design/tokens';
import { ApiException } from '@/core/api';
import { onOutboxChange, outbox } from '@/core/outbox';

/**
 * Oflayn va xato holatlari — demo `.offbar` + `.err-ill` (docs/redesign/shots/23).
 *
 *  - `OfflineBar` — ekran tepasidagi warningBg tasma: wifi-off, "Internet yo'q · N ta o'zgarish navbatda", "Qayta".
 *    Faqat haqiqiy belgi bo'lsa chiqadi: outbox'dagi yozuv tarmoq xatosi bilan to'xtagan yoki chaqiruvchi
 *    so'rov tarmoq xatosi bilan tugaganini aytgan (`offline`).
 *  - `ErrorScreen` — to'liq ekran: halqali katta doira ichida ikonka, sarlavha, izoh, "Qayta urinish" va "Bosh sahifa".
 */

/** Server javob bermadi (fetch yiqildi) — ApiException emas. 4xx/5xx — server bor, bu tarmoq xatosi emas. */
export const isNetworkError = (e: unknown) => !!e && !(e instanceof ApiException);

/** Navbatdagi o'zgarishlar: `count` — jami, `stalled` — tarmoq xatosi bilan to'xtagan (internet yo'q). */
export function useOutboxState() {
  const read = () => {
    const items = outbox.list();
    return { count: items.length, stalled: items.some((i) => i.attempts > 0) };
  };
  const [s, setS] = useState(read);
  useEffect(() => {
    const off = onOutboxChange(() => setS(read()));
    return () => { off(); };
  }, []);
  return s;
}

/**
 * Oflayn tasma (demo `.offbar`): padding 7×14 css, 10 css 600 matn, warning rangida.
 * `offline` — chaqiruvchi tarmoq xatosini ko'rdi; berilmasa faqat outbox holatiga qaraydi.
 */
export function OfflineBar({ offline, onRetry, style }: { offline?: boolean; onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const box = useOutboxState();
  if (!offline && !box.stalled) return null;
  const text = box.count > 0 ? `Internet yo'q · ${box.count} ta o'zgarish navbatda` : "Internet yo'q";
  const retry = () => { haptic.light(); void outbox.flush(); onRetry?.(); };
  return (
    <Appear from={-8} scale={1}>
      <View
        accessibilityRole="alert" accessibilityLiveRegion="polite"
        style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, backgroundColor: c.warningBg, paddingLeft: space.xl, paddingRight: space.sm, minHeight: size.touch }, style]}
      >
        <Icon name="wifi-off" size={size.iconMd} color={c.warning} strokeWidth={1.75} />
        <Txt v="bodyStrong" color="warning" numberOfLines={1} style={{ flex: 1 }}>{text}</Txt>
        <Pressable
          onPress={retry} accessibilityRole="button" accessibilityLabel="Qayta urinish" hitSlop={space.xs}
          style={({ pressed }) => [{ minHeight: size.touch, paddingHorizontal: space.md, justifyContent: 'center' }, pressed && { opacity: 0.6 }]}
        >
          <Txt v="listValue" color="warning">Qayta</Txt>
        </Pressable>
      </View>
    </Appear>
  );
}

/** Demo `.err-ill`: 92 css doira (bgMuted) + 10 css halqa (bgSubtle), ikonka 44 css. */
const ILL = Math.round(92 * DEMO_SCALE);
const HALO = Math.round(10 * DEMO_SCALE);
const ILL_ICON = Math.round(44 * DEMO_SCALE);

export function ErrorIllustration({ icon = 'wifi-off' }: { icon?: IconName }) {
  const { c } = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: ILL, height: ILL, borderRadius: ILL / 2, backgroundColor: c.bgMuted, alignItems: 'center', justifyContent: 'center', boxShadow: `0px 0px 0px ${HALO}px ${c.bgSubtle}` }}>
      <Icon name={icon} size={ILL_ICON} color={c.textMuted} strokeWidth={1.75} />
    </View>
  );
}

/**
 * To'liq ekranli xato shabloni (demo "Ma'lumot yuklanmadi"). `error` berilsa: tarmoq xatosi — wifi-off va
 * "Server bilan aloqa yo'q…", server xatosi — circle-alert va serverning o'z xabari.
 * `home={false}` — "Bosh sahifa" tugmasisiz (masalan qulf yoki modal ichida).
 */
export function ErrorScreen({ error, title, hint, icon, onRetry, home = true, style }: {
  error?: unknown;
  title?: string;
  hint?: string;
  icon?: IconName;
  onRetry?: () => void;
  home?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const net = error === undefined || isNetworkError(error);
  const msg = !net && error instanceof Error && error.message ? error.message : undefined;
  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxl, paddingVertical: space.xxxl, gap: space.xl }, style]}>
      <Appear><ErrorIllustration icon={icon ?? (net ? 'wifi-off' : 'circle-alert')} /></Appear>
      <Appear delay={60} style={{ alignItems: 'center', gap: space.sm, maxWidth: Math.round(220 * DEMO_SCALE) + space.x12 }}>
        <Txt v="titleMd" align="center" accessibilityRole="header">{title ?? "Ma'lumot yuklanmadi"}</Txt>
        <Txt v="body" color="body" align="center">
          {hint ?? msg ?? "Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring. Saqlanganlar yo'qolmaydi."}
        </Txt>
      </Appear>
      <Appear delay={120} style={{ alignItems: 'center', gap: space.lg }}>
        {onRetry ? <Button title="Qayta urinish" icon="refresh-cw" size="sticky" full={false} onPress={onRetry} /> : null}
        {home ? <Button title="Bosh sahifa" variant="secondary" size="lg" full={false} onPress={() => router.replace('/')} /> : null}
      </Appear>
    </View>
  );
}
