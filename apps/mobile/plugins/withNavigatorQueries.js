// Navigator ilovalarini "ko'rish" ruxsati — Android 11+ (package visibility).
//
// Android 11 dan boshlab `Linking.canOpenURL('yandexnavi://')` manifestda `<queries>` bo'lmasa
// ilova o'rnatilgan bo'lsa ham `false` qaytaradi. Natijada "Navigatorda ochish" ro'yxatida
// faqat brauzer qolardi. Sxemalar `src/core/navigate.ts` dagi APPS bilan bir xil bo'lsin.
// iOS'dagi juftligi — app.config.ts → ios.infoPlist.LSApplicationQueriesSchemes.
// Native o'zgarish: yangi build kerak (OTA yetmaydi).
const { withAndroidManifest } = require('@expo/config-plugins');

const SCHEMES = ['yandexnavi', 'yandexmaps', 'dgis', 'google.navigation', 'waze', 'geo'];

module.exports = function withNavigatorQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const queries = (manifest.queries = manifest.queries ?? [{}]);
    const q = queries[0];
    q.intent = q.intent ?? [];
    const has = (scheme) => q.intent.some((i) => (i.data ?? []).some((d) => d.$?.['android:scheme'] === scheme));
    for (const scheme of SCHEMES) {
      if (has(scheme)) continue;
      q.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': scheme } }],
      });
    }
    return cfg;
  });
};
