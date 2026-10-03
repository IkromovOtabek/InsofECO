// Yandex MapKit (react-native-yamap-plus 5.x) uchun native sozlamalar.
//
// 1. FULL versiya (ilgari Lite edi). Sabab — manzil qidiruvi: "Obyekt manzili" maydonida yozish
//    paytida takliflar (Suggest) va xaritadagi nuqtadan manzil (Search / reverse geocoding)
//    faqat Full SDK'da bor. Lite build'da `RTNSuggestsModule`/`RTNSearchModule` mavjud, lekin har
//    chaqiruvni "SUGGEST module is not available in Lite version" bilan rad etadi
//    (node_modules/react-native-yamap-plus/android/src/mapkit/lite/*). Full — ilovaga ~10 MB qo'shadi,
//    evaziga bitta MapKit kaliti bilan xarita + qidiruv ishlaydi (alohida HTTP kalit shart emas).
//    Kutubxona sukut bo'yicha Full: Android `YamapPlus_useYandexMapsLite=false`, iOS podspec
//    `USE_YANDEX_MAPS_LITE` bo'lmasa `4.25.0-full` + `USE_YANDEX_MAPS_FULL=1`. Shuning uchun
//    plugin Lite belgilarini QO'YMAYDI, eski prebuild qoldig'i bo'lsa olib tashlaydi.
//    Lite'ga qaytish kerak bo'lsa: build muhitida `YANDEX_MAPS_LITE=1` (qidiruv o'chadi,
//    AddressPicker HTTP Geosuggest yoki oddiy matnga o'tadi — yiqilmaydi).
// 2. minSdk 26 (Android 8.0) — MapKit AAR shundan pastni qabul qilmaydi, aks holda
//    `processDebugMainManifest` "minSdkVersion 24 cannot be smaller than version 26" bilan yiqiladi.
//    Root build.gradle `android.minSdkVersion` ni `findProperty` bilan o'qiydi.
// Native o'zgarish — yangi EAS build kerak (OTA yetmaydi).
const { withGradleProperties, withPodfile, withProjectBuildGradle } = require('@expo/config-plugins');

const MIN_SDK = '26';
const LITE = process.env.YANDEX_MAPS_LITE === '1';
const LITE_LINE = 'useYandexMapsLite = true';
const POD_ENV = "ENV['USE_YANDEX_MAPS_LITE'] = \"1\"";

function withMinSdk(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((i) => !(i.type === 'property' && i.key === 'android.minSdkVersion'));
    cfg.modResults.push({ type: 'property', key: 'android.minSdkVersion', value: MIN_SDK });
    return cfg;
  });
}

function withVariantAndroid(config) {
  return withProjectBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents.split('\n').filter((l) => l.trim() !== LITE_LINE).join('\n');
    // Lite: kutubxona aynan boolean `true` ni kutadi (gradle.properties dagi "true" satri o'tmaydi)
    if (LITE) src = src.replace(/ext\s*\{/, (m) => `${m}\n        ${LITE_LINE}`);
    cfg.modResults.contents = src;
    return cfg;
  });
}

function withVariantIos(config) {
  return withPodfile(config, (cfg) => {
    let src = cfg.modResults.contents.split('\n').filter((l) => l.trim() !== POD_ENV).join('\n');
    if (LITE) src = `${POD_ENV}\n${src}`;
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withYandexMapKit(config) {
  return withVariantIos(withVariantAndroid(withMinSdk(config)));
};
