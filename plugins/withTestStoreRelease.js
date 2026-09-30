// RevenueCat refuses to run a Test Store key in a non-debuggable (release) Android build: it shows an
// alert and crashes on purpose. For the internal demo APK (never uploaded to Google Play) we mark the
// release build debuggable, which is what the SDK checks. Only applied when the EAS profile sets
// DRRYS_TEST_STORE_APK=1, so a store build is never affected.
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withTestStoreRelease(config) {
  if (process.env.DRRYS_TEST_STORE_APK !== '1') return config;
  return withAppBuildGradle(config, (c) => {
    const src = c.modResults.contents;
    if (src.includes('// drrys: debuggable demo release')) return c;
    const next = src.replace(/(buildTypes\s*\{[\s\S]*?\n(\s*)release\s*\{)/, '$1\n$2    debuggable true // drrys: debuggable demo release');
    if (next === src) throw new Error('withTestStoreRelease: could not find the release build type in app/build.gradle');
    c.modResults.contents = next;
    return c;
  });
};
