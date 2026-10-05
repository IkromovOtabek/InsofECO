import React from 'react';
import { View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { useTheme } from '@/design/theme';
import { ErrorScreen } from './offline';

/**
 * Marshrut xato chegarasi (expo-router `ErrorBoundary` eksporti).
 *
 * Ekran chizilayotganda kutilmagan xato (server kutilmagan shakl qaytardi, `undefined.map`)
 * butun ilovani oq ekranga aylantirmasin: foydalanuvchi xabarni ko'radi va qayta urinadi,
 * navbatdagi (outbox) amallar va sessiya joyida qoladi.
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ErrorScreen
        error={error}
        icon="circle-alert"
        title="Ekranda xato yuz berdi"
        hint="Kutilmagan xato. Qayta urinib ko'ring — saqlangan ma'lumotlar yo'qolmaydi."
        onRetry={() => { void retry(); }}
        home={false}
      />
    </View>
  );
}
