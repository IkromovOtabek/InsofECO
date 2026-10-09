import { existsSync } from 'fs';
import { ExpoConfig } from 'expo/config';

// Android push (FCM) uchun Firebase fayli. EAS'da — "file" turidagi GOOGLE_SERVICES_JSON env (production muhit),
// lokalda — apps/mobile/google-services.json (.gitignore'da). Fayl yo'q bo'lsa build yiqilmaydi, lekin Android'da
// `getExpoPushTokenAsync` xato beradi va push kelmaydi (src/core/push.ts jim o'tkazib yuboradi).
const GOOGLE_SERVICES = process.env.GOOGLE_SERVICES_JSON ?? (existsSync('./google-services.json') ? './google-services.json' : undefined);

// Joylashuv ruxsat matnlari — infoPlist va expo-location plugini bir xil matnni oladi
// (plugin aks holda NSLocationAlwaysUsageDescription ga inglizcha standart matn yozadi).
const LOC_WHEN_IN_USE = 'Obyekt manzilini aniqlash va reys holatini belgilash uchun.';
const LOC_ALWAYS = "Faol reys davomida mashina joylashuvini quruvchi va dispetcherga ko'rsatish uchun (faqat reys vaqtida).";
// Kamera matni (iOS'da bitta NSCameraUsageDescription) — expo-camera va expo-image-picker plaginlari bir xil matnni
// yozsin, aks holda keyingi plagin oldingisini almashtiradi.
const CAMERA = "Davomat uchun yuzingizni skanerlash, profil rasmi, nakladnoy va yetkazish fotosini olish uchun kamera kerak.";

const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? 'e6d74b95-9f55-43c6-93e7-4a8e056de8e9';

// OTA kanali LOKAL yig'iladigan APK uchun (ERP orqali tarqatiladigan, `./gradlew assembleRelease`).
// EAS build kanalni o'zi qo'yadi (eas.json → `channel`), lokal build esa yo'q — sarlavhasiz so'rov
// `eas update --channel production` ni olmaydi. `EXPO_UPDATES_CHANNEL=production npx expo prebuild -p android`
// bilan AndroidManifest'ga `expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY` =
// {"expo-channel-name":"production"} yoziladi. EAS build ichida (EAS_BUILD=true) e'tiborsiz — profil kanali buzilmaydi.
// Batafsil: docs/07-dokonga-chiqarish.md → "Lokal APK (gradle) va OTA".
const LOCAL_CHANNEL = !process.env.EAS_BUILD ? process.env.EXPO_UPDATES_CHANNEL?.trim() || undefined : undefined;

const config: ExpoConfig = {
  name: 'Insof ECO',
  slug: 'insof-eco',
  owner: 'otabekikromov',
  version: '1.0.4',
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
      NSLocationWhenInUseUsageDescription: LOC_WHEN_IN_USE,
      NSLocationAlwaysAndWhenInUseUsageDescription: LOC_ALWAYS,
      UIBackgroundModes: ['location', 'remote-notification'],
      // "Navigatorda ochish" ro'yxati: iOS faqat shu sxemalar uchun `canOpenURL` ga to'g'ri javob beradi.
      // `src/core/navigate.ts` (APPS) va Android `plugins/withNavigatorQueries.js` bilan bir xil bo'lsin.
      // `maps` (Apple Xaritalar) ham yozilgan: iOS ro'yxatda yo'q sxema uchun `canOpenURL` ni har doim
      // `false` qaytaradi — shunda Apple Xaritalar tanlov ro'yxatidan tushib qolardi. Native o'zgarish: yangi build.
      LSApplicationQueriesSchemes: ['yandexnavi', 'yandexmaps', 'dgis', 'comgooglemaps', 'waze', 'maps'],
    },
    config: { usesNonExemptEncryption: false },
    // Apple "required reason API" deklaratsiyasi (PrivacyInfo.xcprivacy) — busiz App Store Connect
    // ITMS-91053 bilan yuklashni rad etadi. RN/Expo, AsyncStorage, MMKV, expo-file-system ishlatadigan
    // API'lar: UserDefaults, fayl vaqti, tizim yuklangan vaqt, disk hajmi. Kuzatuv (tracking) yo'q.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'] },
      ],
    },
  },
  android: {
    package: 'uz.insofeco.app',
    ...(GOOGLE_SERVICES ? { googleServicesFile: GOOGLE_SERVICES } : {}),
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
    // Face ID ishlatilmaydi (davomat — ilova ichidagi kamera skaneri): secure-store NSFaceIDUsageDescription qo'shmasin.
    ['expo-secure-store', { faceIDPermission: false }],
    // Davomat yuz skaneri (ilova ichida, src/features/erp/face-scan.tsx): faqat kamera, mikrofon kerak emas —
    // aks holda plugin RECORD_AUDIO va inglizcha NSMicrophoneUsageDescription qo'shadi. Native: yangi build kerak.
    ['expo-camera', { cameraPermission: CAMERA, microphonePermission: false, recordAudioAndroid: false }],
    ['expo-location', {
      locationWhenInUsePermission: LOC_WHEN_IN_USE,
      locationAlwaysAndWhenInUsePermission: LOC_ALWAYS,
      locationAlwaysPermission: LOC_ALWAYS,
      isIosBackgroundLocationEnabled: true,
      isAndroidBackgroundLocationEnabled: true,
      isAndroidForegroundServiceEnabled: true,
    }],
    // `sounds` — ovoz fayli native to'plamga qo'shiladi: iOS bundle'ga, Android `res/raw` ga.
    // Shuning uchun ovoz o'zgarsa ilovani qayta chiqarish kerak (OTA yetarli emas).
    // `icon` — Android status bar ikonkasi: oq siluet + shaffof fon (adaptive-icon foreground aynan shunday).
    // Busiz Android ilova ikonkasini oladi va u kulrang/oq kvadrat bo'lib ko'rinadi.
    ['expo-notifications', { icon: './assets/adaptive-icon.png', color: '#0b4fd6', sounds: ['./assets/bildirishnoma.wav'] }],
    // Kotlin 1.9.24 — RN 0.76 bilan mos versiya, aks holda Android build yiqiladi (izoh plugin ichida)
    './plugins/withKotlinVersion.js',
    // Yandex MapKit: FULL versiya (manzil takliflari va teskari geokodlash uchun) va Android minSdk 26 (izoh plugin ichida)
    './plugins/withYandexMapKit.js',
    // Android 11+: navigator ilovalarini ko'rish uchun <queries> (Yandex Navigator, Yandex Xaritalar, 2GIS, Google Maps, Waze)
    './plugins/withNavigatorQueries.js',
    // Profil rasmi, ERP forma fotolari va davomat selfisi — galereya va kamera ruxsat matnlari (native: qayta build kerak).
    // Apple review matn haqiqiy ishlatilishga mos bo'lishini tekshiradi — yangi foto holati qo'shilsa shu yerga ham yozing.
    ['expo-image-picker', { photosPermission: "Profil rasmi, nakladnoy yoki yetkazish fotosini galereyadan tanlash uchun.", cameraPermission: CAMERA,
      // Faqat rasm (mediaTypes: ['images']) — mikrofon ishlatilmaydi. `false` bo'lmasa plugin Android'ga RECORD_AUDIO va
      // iOS'ga inglizcha NSMicrophoneUsageDescription qo'shadi: ishlatilmagan ruxsat — review'da rad etish sababi.
      microphonePermission: false }],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3010',
    // Insof ERP — zavod xodimlari (sotuv, logistika, sklad...) shu backend bilan kiradi
    erpUrl: process.env.EXPO_PUBLIC_ERP_URL ?? 'http://localhost:3000',
    // Yandex MapKit kaliti (developer.tech.yandex.ru → MapKit SDK). Asosiy manba —
    // EXPO_PUBLIC_YANDEX_MAPKIT_KEY (JS to'plamiga yoziladi), bu yer — zaxira (`core/config.ts`).
    // Kalitsiz build'da xarita umuman chizilmaydi, ekranlar raqam va ro'yxat bilan ishlaydi.
    yandexMapKitKey: process.env.EXPO_PUBLIC_YANDEX_MAPKIT_KEY ?? process.env.YANDEX_MAPKIT_KEY ?? '',
    // Ixtiyoriy zaxira — MapKit qidiruvi ishlamasa (eski Lite build, kalit cheklangan) manzil takliflari
    // HTTP orqali: EXPO_PUBLIC_YANDEX_GEOSUGGEST_KEY (Geosuggest API) va EXPO_PUBLIC_YANDEX_GEOCODER_KEY
    // (HTTP Geocoder — taklifning koordinatasi va xaritadagi nuqtaning manzili). Ikkalasi ham
    // to'g'ridan-to'g'ri `process.env` dan o'qiladi (src/features/address/geocode.ts); bo'lmasa — oddiy matn + GPS.
    // Kalit qo'shilgach: `.env` (lokal) va EAS → Environment variables (production/preview) ga yozib, qayta build.
    // Kalitsiz build'da xarita joyida aniq izoh chiqadi (src/core/map.tsx → MapUnavailable).
    eas: { projectId: EAS_PROJECT_ID },
  },
  // EAS Update (OTA): JS/UI o'zgarishlari do'konsiz yetib boradi — `eas update --channel production`.
  // Native o'zgarish (yangi kutubxona, ruxsat, ikonka) bo'lsa `version` ni oshirib yangi build kerak:
  // runtimeVersion = appVersion, ya'ni 1.0.1 build'i faqat 1.0.1 update'larini oladi.
  // OTA HAR DOIM `--environment production` bilan: aks holda lokal apps/mobile/.env (Wi-Fi IP) to'plamga yoziladi.
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    // Ilova ochilganda yangilanishni 10 s kutadi, bo'lmasa eskisi bilan ishlayveradi
    fallbackToCacheTimeout: 10000,
    // Faqat lokal APK yig'ishda (yuqoridagi LOCAL_CHANNEL izohi)
    ...(LOCAL_CHANNEL ? { requestHeaders: { 'expo-channel-name': LOCAL_CHANNEL } } : {}),
  },
  runtimeVersion: { policy: 'appVersion' },
};

export default config;
