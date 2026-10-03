import { ExpoConfig } from 'expo/config';

const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? 'e6d74b95-9f55-43c6-93e7-4a8e056de8e9';

const config: ExpoConfig = {
  name: 'Insof ECO',
  slug: 'insof-eco',
  owner: 'otabekikromov',
  version: '1.0.0',
  scheme: 'insofeco',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: './assets/icon.png',
  // Splash oq fonda asl logo bilan — JS ochilish ekrani (launch.tsx) ham oq, rang sakramaydi.
  // Ikonka va bildirishnoma rangi o'zgarmagan.
  splash: { image: './assets/splash-light.png', resizeMode: 'contain', backgroundColor: '#ffffff' },
  ios: {
    bundleIdentifier: 'uz.insofeco.app',
    supportsTablet: false,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'Obyekt manzilini aniqlash va reys holatini belgilash uchun.',
      NSLocationAlwaysAndWhenInUseUsageDescription: 'Faol reys davomida mashina joylashuvini quruvchi va dispetcherga ko\'rsatish uchun (faqat reys vaqtida).',
      UIBackgroundModes: ['location', 'remote-notification'],
    },
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'uz.insofeco.app',
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#0b4fd6' },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'POST_NOTIFICATIONS',
      'RECEIVE_BOOT_COMPLETED',
    ],
  },
  plugins: [
    'expo-router',
    // Face ID ishlatilmaydi — plugin qo'shadigan inglizcha NSFaceIDUsageDescription'ni olib tashlaymiz
    ['expo-secure-store', { faceIDPermission: false }],
    ['expo-location', { isAndroidBackgroundLocationEnabled: true, isAndroidForegroundServiceEnabled: true }],
    // `sounds` — ovoz fayli native to'plamga qo'shiladi: iOS bundle'ga, Android `res/raw` ga.
    // Shuning uchun ovoz o'zgarsa ilovani qayta chiqarish kerak (OTA yetarli emas).
    ['expo-notifications', { color: '#0b4fd6', sounds: ['./assets/bildirishnoma.wav'] }],
    // Kotlin 1.9.24 — RN 0.76 bilan mos versiya, aks holda Android build yiqiladi (izoh plugin ichida)
    './plugins/withKotlinVersion.js',
    // Yandex MapKit: Lite versiya va Android minSdk 26 (izoh plugin ichida)
    './plugins/withYandexMapKit.js',
    // Profil rasmi, ERP forma fotolari va davomat selfisi — galereya va kamera ruxsat matnlari (native: qayta build kerak).
    // Apple review matn haqiqiy ishlatilishga mos bo'lishini tekshiradi — yangi foto holati qo'shilsa shu yerga ham yozing.
    ['expo-image-picker', { photosPermission: "Profil rasmi, nakladnoy yoki yetkazish fotosini galereyadan tanlash uchun.", cameraPermission: "Profil rasmi, nakladnoy va yetkazish fotosini olish hamda ishga kelganda davomat uchun selfi tushirish uchun." }],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3010',
    // Insof ERP — zavod xodimlari (sotuv, logistika, sklad...) shu backend bilan kiradi
    erpUrl: process.env.EXPO_PUBLIC_ERP_URL ?? 'http://localhost:3000',
    // Yandex MapKit kaliti (developer.tech.yandex.ru → MapKit SDK). Asosiy manba —
    // EXPO_PUBLIC_YANDEX_MAPKIT_KEY (JS to'plamiga yoziladi), bu yer — zaxira (`core/config.ts`).
    // Kalitsiz build'da xarita umuman chizilmaydi, ekranlar raqam va ro'yxat bilan ishlaydi.
    yandexMapKitKey: process.env.EXPO_PUBLIC_YANDEX_MAPKIT_KEY ?? process.env.YANDEX_MAPKIT_KEY ?? '',
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
