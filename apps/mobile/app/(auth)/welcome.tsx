import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Gap, IconTile, ListItem, Txt } from '@/design/primitives';
import { IconName } from '@/design/icons';
import { Appear, stagger } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';

/**
 * Welcome — ilova ochilganda birinchi oyna.
 * Brend belgisi + nom + qiymat taklifi, uchta afzallik qatori, pastda ikkita tugma.
 */
const PERKS: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'briefcase', title: 'Loyihalar', desc: 'byudjet, progress, vazifalar, jamoa' },
  { icon: 'package', title: 'Material', desc: "so'rov → tasdiq → yuk → obyekt" },
  { icon: 'banknote', title: 'Hisob-kitob', desc: 'daromad, xarajat, foyda — real vaqtda' },
];

export default function Welcome() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp, paddingHorizontal: space.pageX, paddingTop: insets.top + space.x12, paddingBottom: insets.bottom + space.xl }}>
      <View style={{ flex: 1 }}>
        <Appear from={18}>
          <IconTile icon="layers" module="brand" size={size.iconTile + space.lg} />
        </Appear>
        <Gap h={space.xxl} />
        <Appear delay={90}><Txt v="titleLg">Insof ECO</Txt></Appear>
        <Gap h={space.sm} />
        <Appear delay={150}>
          <Txt v="body" color="muted">Qurilish ekotizimi: loyiha · quruvchi · material · transport</Txt>
        </Appear>
        <Gap h={space.xxxl} />
        <Appear delay={220}>
          <Card style={{ paddingVertical: space.xs }}>
            {PERKS.map((p, i) => (
              <Appear key={p.title} delay={260 + stagger(i, 70)}>
                <ListItem icon={p.icon} module="brand" title={p.title} subtitle={p.desc} last={i === PERKS.length - 1} />
              </Appear>
            ))}
          </Card>
        </Appear>
      </View>

      <Appear delay={430} style={{ gap: space.md }}>
        <Button title="Kirish" size="lg" iconRight="arrow-right" onPress={() => router.push('/(auth)/login')} />
        <Button title="Ro'yxatdan o'tish" variant="secondary" size="lg" onPress={() => router.push('/(auth)/register')} />
      </Appear>
      <Gap h={space.lg} />
      <Txt v="caption" align="center">
        Davom etish orqali foydalanish shartlari va maxfiylik siyosatiga rozilik bildirasiz
      </Txt>
    </View>
  );
}
