// Android: RN 0.76.3 o'z version-catalog'ida Kotlin 1.9.24 ni pin qiladi, `expo prebuild` esa
// root build.gradle ga 1.9.25 yozadi — natijada `expo-modules-core:compileDebugKotlin`
// Compose compiler xatosi bilan yiqiladi. Yechim: gradle.properties ga
// `android.kotlinVersion=1.9.24` (root build.gradle uni `findProperty` bilan o'qiydi).
// Plugin sifatida yozilgani uchun EAS bulutidagi prebuild'da ham, lokal prebuild'da ham
// avtomatik qo'llanadi — qo'lda gradle.properties tuzatish shart emas.
const { withGradleProperties } = require('@expo/config-plugins');

const KOTLIN_VERSION = '1.9.24';

module.exports = function withKotlinVersion(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'android.kotlinVersion'),
    );
    cfg.modResults.push({ type: 'property', key: 'android.kotlinVersion', value: KOTLIN_VERSION });
    return cfg;
  });
};
