import React from 'react';
import { Platform, StatusBar, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Gap, Txt } from '@/design/primitives';
import { Appear, PressScale } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';

/**
 * Welcome — ilova ochilganda birinchi oyna.
 * Yuqori 60%: brend fon + logotip belgisi + qiymat taklifi. Pastki: oq "sheet" ichida ikkita tugma.
 */
export default function Welcome() {
  const router = useRouter();
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const brand = dark ? '#12563A' : '#0E8A4F';

  return (
    <View style={{ flex: 1, backgroundColor: brand }}>
      <StatusBar barStyle="light-content" />
      {/* Hero */}
      <View style={{ flex: 1, paddingTop: insets.top + 48, paddingHorizontal: 28, justifyContent: 'space-between' }}>
        <View>
          <Appear from={18}>
            <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
              <Txt style={{ fontSize: 32, color: '#fff', fontWeight: '800', letterSpacing: -1 }}>IE</Txt>
            </View>
          </Appear>
          <Gap h={28} />
          <Appear delay={90}><Txt v="display" style={{ color: '#fff' }}>Insof ECO</Txt></Appear>
          <Gap h={10} />
          <Appear delay={150}>
            <Txt v="subtitle" style={{ color: 'rgba(255,255,255,0.88)', fontWeight: '400', lineHeight: 30 }}>
              Qurilish ekotizimi:{'\n'}loyiha · quruvchi · material · transport
            </Txt>
          </Appear>
        </View>
        <View style={{ paddingBottom: 28 }}>
          {[
            ['Loyihalar', 'byudjet, progress, vazifalar, jamoa'],
            ['Material', "so'rov → tasdiq → yuk → obyekt"],
            ['Hisob-kitob', 'daromad, xarajat, foyda — real vaqtda'],
          ].map(([t, d], i) => (
            <Appear key={t} delay={220 + i * 70} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFA800', marginRight: 14 }} />
              <Txt v="callout" style={{ color: '#fff' }}><Txt v="callout" style={{ color: '#fff', fontWeight: '600' }}>{t}</Txt> · {d}</Txt>
            </Appear>
          ))}
        </View>
      </View>

      {/* Sheet */}
      <View style={{ backgroundColor: c.bgCanvas, borderTopLeftRadius: Platform.OS === 'ios' ? 28 : 24, borderTopRightRadius: Platform.OS === 'ios' ? 28 : 24, paddingHorizontal: space.xl, paddingTop: 28, paddingBottom: insets.bottom + 20 }}>
        <Appear delay={430}>
          <PressScale onPress={() => router.push('/(auth)/login')}>
            <View style={{ height: 54, borderRadius: 16, backgroundColor: c.brandPrimary, alignItems: 'center', justifyContent: 'center' }}>
              <Txt style={{ fontSize: 17, fontWeight: '700', color: c.textOnBrand }}>Kirish</Txt>
            </View>
          </PressScale>
          <Gap h={12} />
          <Button title="Ro'yxatdan o'tish" variant="secondary" size="lg" onPress={() => router.push('/(auth)/register')} />
        </Appear>
        <Gap h={18} />
        <Txt v="caption" color="secondary" style={{ textAlign: 'center' }}>
          Davom etish orqali foydalanish shartlari va maxfiylik siyosatiga rozilik bildirasiz
        </Txt>
      </View>
      <View style={{ position: 'absolute', right: -60, top: 120, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.05)' }} pointerEvents="none" />
      <View style={{ position: 'absolute', left: -40, top: 300, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0 }} pointerEvents="none" />
      <View style={{ height: 0, borderRadius: radius.full }} />
    </View>
  );
}
