import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Insof ECO',
  slug: 'insof-eco',
  owner: 'otabekikromov',
  version: '0.1.0',
  scheme: 'insofeco',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: './assets/icon.png',
  splash: { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: '#1B5E3F' },
  ios: {
    bundleIdentifier: 'uz.insofeco.app',
    supportsTablet: false,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'Obyekt manzilini aniqlash va reys holatini belgilash uchun.',
      NSLocationAlwaysAndWhenInUseUsageDescription: 'Faol reys davomida mashina joylashuvini quruvchi va dispetcherga ko\'rsatish uchun (faqat reys vaqtida).',
      NSCameraUsageDescription: 'Nakladnoy va yetkazish fotosini olish uchun.',
      UIBackgroundModes: ['location', 'remote-notification'],
    },
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'uz.insofeco.app',
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#1B5E3F' },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'CAMERA',
      'POST_NOTIFICATIONS',
      'RECEIVE_BOOT_COMPLETED',
    ],
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY ?? '' } },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-location', { isAndroidBackgroundLocationEnabled: true, isAndroidForegroundServiceEnabled: true }],
    ['expo-notifications', { color: '#1B5E3F' }],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3010',
    // Insof ERP — zavod xodimlari (sotuv, logistika, sklad...) shu backend bilan kiradi
    erpUrl: process.env.EXPO_PUBLIC_ERP_URL ?? 'http://localhost:3000',
    // Android'da react-native-maps Google Maps'ni ishlatadi va kalitsiz ilovani YIQITADI
    // (IllegalStateException: API key not found). Shuning uchun kalit bor-yo'qligini
    // to'plam ichiga chiqaramiz — kalitsiz xarita umuman chizilmaydi.
    hasMaps: !!process.env.GOOGLE_MAPS_ANDROID_KEY,
    eas: { projectId: process.env.EAS_PROJECT_ID ?? 'e6d74b95-9f55-43c6-93e7-4a8e056de8e9' },
  },
  updates: { url: process.env.EAS_UPDATE_URL },
  runtimeVersion: { policy: 'appVersion' },
};

export default config;
