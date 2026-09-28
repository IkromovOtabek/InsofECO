import { ExpoConfig } from 'expo/config';

const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? 'e6d74b95-9f55-43c6-93e7-4a8e056de8e9';

const config: ExpoConfig = {
  name: 'Insof ECO',
  slug: 'insof-eco',
  owner: 'otabekikromov',
  version: '0.2.0',
  scheme: 'insofeco',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: './assets/icon.png',
  // Brend ko'ki — logotip plitkasining rangi; ikonka, splash va bildirishnoma bittada
  splash: { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: '#0b1120' },
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
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#0b1120' },
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
    // `sounds` — ovoz fayli native to'plamga qo'shiladi: iOS bundle'ga, Android `res/raw` ga.
    // Shuning uchun ovoz o'zgarsa ilovani qayta chiqarish kerak (OTA yetarli emas).
    ['expo-notifications', { color: '#f59e0b', sounds: ['./assets/bildirishnoma.wav'] }],
    // Kotlin 1.9.24 — RN 0.76 bilan mos versiya, aks holda Android build yiqiladi (izoh plugin ichida)
    './plugins/withKotlinVersion.js',
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3010',
    // Insof ERP — zavod xodimlari (sotuv, logistika, sklad...) shu backend bilan kiradi
    erpUrl: process.env.EXPO_PUBLIC_ERP_URL ?? 'http://localhost:3000',
    // Android'da react-native-maps Google Maps'ni ishlatadi va kalitsiz ilovani YIQITADI
    // (IllegalStateException: API key not found). Shuning uchun kalit bor-yo'qligini
    // to'plam ichiga chiqaramiz — kalitsiz xarita umuman chizilmaydi.
    hasMaps: !!process.env.GOOGLE_MAPS_ANDROID_KEY,
    eas: { projectId: EAS_PROJECT_ID },
  },
  // EAS Update (OTA): JS/UI o'zgarishlari do'konsiz yetib boradi — `eas update --channel production`.
  // Native o'zgarish (yangi kutubxona, ruxsat, ikonka) bo'lsa `version` ni oshirib yangi build kerak:
  // runtimeVersion = appVersion, ya'ni 0.2.0 build'i faqat 0.2.0 update'larini oladi.
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    // Ilova ochilganda yangilanishni 10 s kutadi, bo'lmasa eskisi bilan ishlayveradi
    fallbackToCacheTimeout: 10000,
  },
  runtimeVersion: { policy: 'appVersion' },
};

export default config;
