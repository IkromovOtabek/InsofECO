// iOS: barcha Pod target'larining minimal iOS versiyasi ilovanikidan (15.1) past bo'lmasin.
//
// Ba'zi kutubxonalar resource bundle target'larida eski qiymat qoldiradi (lottie 13.0/13.4, RNSVG 12.4,
// async-storage 13.4, ReachabilitySwift 12.0, Sentry 11.0). Xcode 26 da bu ogohlantirish edi, Xcode 27 SDK
// (EAS `image: latest`) uni XATO deb hisoblaydi va archive yiqiladi. Podfile `post_install` ga qo'shiladi —
// EAS bulutidagi prebuild'da ham, lokal prebuild'da ham avtomatik. Native: yangi build kerak.
const { withPodfile } = require('@expo/config-plugins');

const MIN = '15.1';
const MARK = '# insof: pods deployment target';
const SNIPPET = `
    ${MARK}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        if c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN}
          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN}'
        end
      end
    end`;

// `post_install` blokining OXIRIGA (react_native_post_install keyin) — RN qiymatni qayta yozib qo'ymasin
function addSnippet(src) {
  if (src.includes(MARK)) return src;
  const start = src.search(/^( *)post_install do \|installer\|/m);
  if (start < 0) throw new Error('withPodsDeploymentTarget: Podfile da post_install topilmadi');
  const indent = src.slice(start).match(/^( *)/)[1];
  const end = src.indexOf(`\n${indent}end\n`, start);
  if (end < 0) throw new Error('withPodsDeploymentTarget: post_install bloki oxiri topilmadi');
  return `${src.slice(0, end)}\n${SNIPPET.replace(/^\n/, '')}${src.slice(end)}`;
}

module.exports = function withPodsDeploymentTarget(config) {
  return withPodfile(config, (cfg) => {
    cfg.modResults.contents = addSnippet(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.addSnippet = addSnippet;
