// Yandex MapKit (react-native-yamap-plus 5.x) uchun native sozlamalar.
//
// 1. Lite versiya — faqat xarita, belgi, chiziq. Qidiruv/marshrut/transport modullari
//    (Full) bizga kerak emas: manzil va yo'l serverda Yandex HTTP API orqali olinadi.
//    Lite ilovani ~10 MB yengil qiladi. 5.x da Expo plugini yo'q, shuning uchun o'zimiz:
//    Android — root build.gradle `ext.useYandexMapsLite = true` (kutubxona aynan boolean
//    `true` ni kutadi, gradle.properties dagi "true" satri o'tmaydi), iOS — Podfile boshida ENV.
// 2. minSdk 26 (Android 8.0) — MapKit AAR shundan pastni qabul qilmaydi, aks holda
//    `processDebugMainManifest` "minSdkVersion 24 cannot be smaller than version 26" bilan yiqiladi.
//    Root build.gradle `android.minSdkVersion` ni `findProperty` bilan o'qiydi.
const { withGradleProperties, withPodfile, withProjectBuildGradle } = require('@expo/config-plugins');

const MIN_SDK = '26';
const LITE_LINE = 'useYandexMapsLite = true';
const POD_ENV = "ENV['USE_YANDEX_MAPS_LITE'] = \"1\"";

function withMinSdk(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((i) => !(i.type === 'property' && i.key === 'android.minSdkVersion'));
    cfg.modResults.push({ type: 'property', key: 'android.minSdkVersion', value: MIN_SDK });
    return cfg;
  });
}

function withLiteAndroid(config) {
  return withProjectBuildGradle(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (!src.includes(LITE_LINE)) {
      // buildscript { ext { ... } } — birinchi `ext {` bloki ichiga qo'shiladi
      cfg.modResults.contents = src.replace(/ext\s*\{/, (m) => `${m}\n        ${LITE_LINE}`);
    }
    return cfg;
  });
}

function withLiteIos(config) {
  return withPodfile(config, (cfg) => {
    if (!cfg.modResults.contents.includes(POD_ENV)) cfg.modResults.contents = `${POD_ENV}\n${cfg.modResults.contents}`;
    return cfg;
  });
}

module.exports = function withYandexMapKit(config) {
  return withLiteIos(withLiteAndroid(withMinSdk(config)));
};
